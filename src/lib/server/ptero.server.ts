// Pterodactyl Application API (and optional Client API for live usage). Server-only.
import { env, panelUrl } from "./config.server";
import type { Plan, ServiceId } from "../services";
import type { ServerStatus } from "../portal-types";

export class PteroError extends Error {
  constructor(public status: number, public body: string) {
    super(`Game panel request failed [${status}]: ${body}`);
  }
}

async function fetchPteroEndpoint(
  path: string,
  init: RequestInit,
  authKey: string,
  apiPrefix: "/api/application" | "/api/client",
): Promise<Response> {
  const publicBase = panelUrl();
  const internalBase = env("PTERO_INTERNAL_URL")?.replace(/\/+$/, "") || "";
  const publicHost = (() => {
    try {
      return new URL(publicBase).host;
    } catch {
      return "game.panel.sparrowx.net";
    }
  })();

  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${authKey}`,
    Accept: "Application/vnd.pterodactyl.v1+json",
    "Content-Type": "application/json",
  };

  // Prefer direct internal bridge when configured (avoids OVH Docker hairpin NAT issues)
  if (internalBase) {
    try {
      const res = await fetch(`${internalBase}${apiPrefix}${path}`, {
        ...init,
        headers: {
          ...baseHeaders,
          Host: publicHost,
          "X-Forwarded-Host": publicHost,
          "X-Forwarded-Proto": "https",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status !== 502 && res.status !== 503 && res.status !== 504) {
        return res;
      }
    } catch {
      // Fall back to public HTTPS panel URL
    }
  }

  return fetch(`${publicBase}${apiPrefix}${path}`, {
    ...init,
    headers: baseHeaders,
    signal: AbortSignal.timeout(10000),
  });
}

async function app<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = env("PTERO_APPLICATION_API_KEY");
  if (!key) throw new Error("PTERO_APPLICATION_API_KEY is not configured");
  const res = await fetchPteroEndpoint(path, init, key, "/api/application");
  const text = await res.text();
  if (!res.ok) {
    throw new PteroError(res.status, text);
  }
  return (text ? JSON.parse(text) : null) as T;
}

type PUser = {
  attributes: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    language?: string;
    root_admin?: boolean;
  };
};

export async function getUserById(userId: number) {
  try {
    const r = await app<PUser>(`/users/${userId}`);
    return r.attributes ?? null;
  } catch (err) {
    if (err instanceof PteroError && err.status === 404) return null;
    throw err;
  }
}

export async function findUserByEmail(email: string) {
  const clean = email.trim().toLowerCase();
  const r = await app<{ data: PUser[] }>(`/users?filter[email]=${encodeURIComponent(clean)}`);
  const exact = r.data.find((u) => u.attributes.email.trim().toLowerCase() === clean);
  return exact?.attributes ?? null;
}

export async function createUser(input: { email: string; username: string; firstName: string; password: string }) {
  const cleanEmail = input.email.trim().toLowerCase();
  const cleanFirst = input.firstName.trim().replace(/[^a-zA-Z0-9 ._-]/g, "").slice(0, 50) || "Sparrow";
  let candidateUsername = input.username
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[^a-z0-9]+$/, "")
    .slice(0, 24) || `player_${Math.floor(1000 + Math.random() * 9000)}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await app<PUser>(`/users`, {
        method: "POST",
        body: JSON.stringify({
          email: cleanEmail,
          username: candidateUsername,
          first_name: cleanFirst,
          last_name: "Client",
          password: input.password,
        }),
      });
      return r.attributes;
    } catch (err) {
      if (err instanceof PteroError && err.status === 422) {
        // If email already exists in Pterodactyl, return the existing account cleanly
        if (/email/i.test(err.body) && /taken|already|exists/i.test(err.body)) {
          const existing = await findUserByEmail(cleanEmail).catch(() => null);
          if (existing) return existing;
        }
        // If username collided or failed format, retry with a unique suffix
        const randHex = Array.from(crypto.getRandomValues(new Uint8Array(2)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
        candidateUsername = `${candidateUsername.slice(0, 18).replace(/[^a-z0-9]+$/, "") || "player"}_${randHex}`;
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unable to provision Pterodactyl user after username retries.");
}

export async function setUserPassword(userId: number, password: string) {
  const u = (await app<PUser>(`/users/${userId}`)).attributes;
  const updated = await app<PUser>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({
      email: u.email,
      username: u.username,
      first_name: u.first_name?.trim() || "Sparrow",
      last_name: u.last_name?.trim() || "Client",
      language: u.language || "en",
      root_admin: Boolean(u.root_admin),
      password,
    }),
  });
  return updated?.attributes ?? u;
}

export async function unsuspendServer(serverId: number): Promise<void> {
  await app(`/servers/${serverId}/unsuspend`, { method: "POST" });
}

/** Egg per service, from env "PTERO_EGG_FIVEM" etc. formatted as "nestId:eggId". */
function eggFor(service: ServiceId): { nest: number; egg: number } {
  const raw = env(`PTERO_EGG_${service.toUpperCase()}`);
  const m = raw?.match(/^(\d+):(\d+)$/);
  if (!m) throw new Error(`Game panel egg for ${service} is not configured (PTERO_EGG_${service.toUpperCase()}="nest:egg")`);
  return { nest: Number(m[1]), egg: Number(m[2]) };
}

type EggResp = {
  attributes: {
    docker_image: string;
    startup: string;
    relationships: { variables: { data: { attributes: { env_variable: string; default_value: string } }[] } };
  };
};

export async function createServer(input: { userId: number; name: string; service: ServiceId; plan: Plan }) {
  const { nest, egg } = eggFor(input.service);
  const eggInfo = (await app<EggResp>(`/nests/${nest}/eggs/${egg}?include=variables`)).attributes;
  const environment: Record<string, string> = {};
  for (const v of eggInfo.relationships.variables.data) environment[v.attributes.env_variable] = v.attributes.default_value ?? "";
  if (input.plan.slots) {
    for (const k of ["MAX_PLAYERS", "MAX_CLIENTS", "SERVER_SLOTS"]) if (k in environment) environment[k] = String(input.plan.slots);
  }
  const location = Number(env("PTERO_LOCATION_ID") ?? "1");
  const r = await app<{ attributes: { id: number; identifier: string } }>(`/servers`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      user: input.userId,
      egg,
      docker_image: eggInfo.docker_image,
      startup: eggInfo.startup,
      environment,
      limits: { memory: input.plan.ramMb, swap: 0, disk: input.plan.diskGb * 1024, io: 500, cpu: Math.round(input.plan.vcpu * 100) },
      feature_limits: { databases: 1, allocations: 1, backups: 2 },
      deploy: { locations: [location], dedicated_ip: false, port_range: [] },
      start_on_completion: true,
    }),
  });
  return r.attributes;
}

type PServer = {
  attributes: {
    id: number;
    identifier: string;
    name: string;
    suspended: boolean;
    status: string | null;
    limits: { memory: number; cpu: number; disk: number };
    relationships?: { allocations?: { data: { attributes: { ip: string; ip_alias: string | null; port: number; assigned: boolean } }[] } };
  };
};

export type LiveServer = {
  id: number;
  identifier: string;
  name: string;
  status: ServerStatus;
  address: string | null;
  ramLimitMb: number;
  cpuLimit: number;
  diskLimitGb: number;
  ramUsedMb: number | null;
  cpuUsed: number | null;
};

async function resources(identifier: string): Promise<{ state: string; mem: number; cpu: number } | null> {
  const key = env("PTERO_CLIENT_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch(`${panelUrl()}/api/client/servers/${identifier}/resources`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "Application/vnd.pterodactyl.v1+json" },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { attributes: { current_state: string; resources: { memory_bytes: number; cpu_absolute: number } } };
    return { state: j.attributes.current_state, mem: j.attributes.resources.memory_bytes / 1048576, cpu: j.attributes.resources.cpu_absolute };
  } catch {
    return null;
  }
}

export async function listUserServers(userId: number): Promise<LiveServer[]> {
  const u = await app<{ attributes: { relationships: { servers: { data: PServer[] } } } }>(`/users/${userId}?include=servers`);
  const servers = u.attributes.relationships.servers.data;
  return Promise.all(
    servers.map(async (s) => {
      const full = await app<PServer>(`/servers/${s.attributes.id}?include=allocations`).catch(() => s);
      const a = full.attributes;
      const alloc = a.relationships?.allocations?.data.find((x) => x.attributes.assigned)?.attributes;
      const live = await resources(a.identifier);
      let status: ServerStatus = "ONLINE";
      if (a.suspended || a.status === "suspended") status = "SUSPENDED";
      else if (a.status === "installing" || a.status === "install_failed") status = "INSTALLING";
      else if (live) status = live.state === "running" ? "ONLINE" : "OFFLINE";
      return {
        id: a.id,
        identifier: a.identifier,
        name: a.name,
        status,
        address: alloc ? `${alloc.ip_alias || alloc.ip}:${alloc.port}` : null,
        ramLimitMb: a.limits.memory,
        cpuLimit: a.limits.cpu,
        diskLimitGb: Math.round(a.limits.disk / 1024),
        ramUsedMb: live ? Math.round(live.mem) : null,
        cpuUsed: live ? Math.round(live.cpu) : null,
      };
    }),
  );
}

export async function sendServerPower(
  identifier: string,
  signal: "start" | "stop" | "restart" | "kill",
): Promise<void> {
  const key = env("PTERO_CLIENT_API_KEY");
  if (!key) {
    throw new Error("PTERO_CLIENT_API_KEY is not configured for remote power actions");
  }
  if (!/^[a-z0-9]{6,16}$/i.test(identifier)) {
    throw new Error("Invalid server identifier");
  }
  const res = await fetch(`${panelUrl()}/api/client/servers/${identifier}/power`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "Application/vnd.pterodactyl.v1+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ signal }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pterodactyl power ${res.status}: ${text.slice(0, 180)}`);
  }
}
