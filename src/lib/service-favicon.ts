import { useEffect } from "react";

export interface ServiceFaviconMeta {
  href: string;
  type: string;
}

export function resolveServiceFavicon(
  hostname: string,
  pathname: string,
  search: string,
): ServiceFaviconMeta {
  const host = hostname.toLowerCase();
  const path = pathname.toLowerCase();
  const params = new URLSearchParams(search);

  if (host.startsWith("db.") || path === "/db" || params.get("db") === "1") {
    return { href: "/logos/sparrowx-db.png", type: "image/png" };
  }

  if (
    host.startsWith("sec.") ||
    host.startsWith("shield.") ||
    path === "/shield" ||
    params.get("shield") === "1" ||
    params.get("sec") === "1"
  ) {
    return { href: "/logos/sparrowx-shield.png", type: "image/png" };
  }

  if (
    host.startsWith("file.") ||
    host.startsWith("drop.") ||
    path === "/drop" ||
    path === "/f" ||
    path.startsWith("/f/") ||
    params.get("file") === "1" ||
    params.get("drop") === "1"
  ) {
    return { href: "/logos/sparrowx-drop.png", type: "image/png" };
  }

  if (
    host.startsWith("password.") ||
    host.startsWith("passwd.") ||
    host.startsWith("keys.") ||
    path === "/keys" ||
    params.get("password") === "1" ||
    params.get("keys") === "1"
  ) {
    return { href: "/logos/sparrowx-keys.png", type: "image/png" };
  }

  if (
    host.startsWith("api.") ||
    host.startsWith("rest.") ||
    params.get("api") === "1"
  ) {
    return { href: "/logos/sparrowx-network.png", type: "image/png" };
  }

  if (host.startsWith("game.") || path === "/game" || path.startsWith("/game/")) {
    return { href: "/logos/sparrowx-main.png", type: "image/png" };
  }

  if (path === "/story") {
    return { href: "/logos/sparrowx-network.png", type: "image/png" };
  }

  return { href: "/logos/sparrowx-silver.png", type: "image/png" };
}

export function applyServiceFavicon(meta: ServiceFaviconMeta): void {
  if (typeof document === "undefined") return;

  const existingLinks = document.head.querySelectorAll(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
  );
  existingLinks.forEach((node) => node.remove());

  const iconLink = document.createElement("link");
  iconLink.rel = "icon";
  iconLink.type = meta.type;
  iconLink.href = meta.href;
  document.head.appendChild(iconLink);

  const shortcutLink = document.createElement("link");
  shortcutLink.rel = "shortcut icon";
  shortcutLink.href = meta.href;
  document.head.appendChild(shortcutLink);

  const appleLink = document.createElement("link");
  appleLink.rel = "apple-touch-icon";
  appleLink.href = meta.href;
  document.head.appendChild(appleLink);
}

export function useServiceFavicon(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      const meta = resolveServiceFavicon(
        window.location.hostname,
        window.location.pathname,
        window.location.search,
      );
      applyServiceFavicon(meta);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
}
