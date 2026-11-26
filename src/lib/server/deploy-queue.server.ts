import { EventEmitter } from "node:events";
import type { Queue } from "bullmq";
import type Redis from "ioredis";

export const DEPLOY_QUEUE_NAME = "sparrowx-deploy-builds";

export interface DeployJobPayload {
  kind: "build" | "rollback" | "stop" | "start" | "restart" | "delete";
  projectId: string;
  deploymentId: string;
  targetImageTag?: string;
  actorEmail: string;
  triggerSource: "manual" | "git_push" | "rollback" | "webhook";
}

export interface StreamedDeployLog {
  id: string;
  deploymentId: string;
  projectId: string;
  stage: "clone" | "build" | "healthcheck" | "route" | "runtime";
  level: "info" | "warn" | "error" | "success";
  message: string;
  createdAt: string;
}

export function deployLogChannel(deploymentId: string): string {
  return `spx:deploy:logs:${deploymentId}`;
}

const localLogBus = new EventEmitter();
localLogBus.setMaxListeners(200);

let cachedRedisUrl: string | null = null;
let cachedPub: Redis | null = null;
let cachedQueue: Queue<DeployJobPayload> | null = null;

export function getRedisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim();
  return url && url.length > 0 ? url : null;
}

async function getPublisher(): Promise<Redis | null> {
  const url = getRedisUrl();
  if (!url) return null;
  if (cachedPub && cachedRedisUrl === url) return cachedPub;
  try {
    const { default: IORedis } = await import("ioredis");
    cachedRedisUrl = url;
    cachedPub = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    cachedPub.on("error", () => {});
    await cachedPub.connect().catch(() => {});
    return cachedPub;
  } catch {
    return null;
  }
}

export async function getDeployQueue(): Promise<Queue<DeployJobPayload> | null> {
  const url = getRedisUrl();
  if (!url) return null;
  if (cachedQueue) return cachedQueue;
  try {
    const [{ Queue: BullQueue }, { default: IORedis }] = await Promise.all([
      import("bullmq"),
      import("ioredis"),
    ]);
    const connection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    connection.on("error", () => {});
    cachedQueue = new BullQueue<DeployJobPayload>(DEPLOY_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 200 },
      },
    });
    return cachedQueue;
  } catch {
    return null;
  }
}

/**
 * Enqueues a BullMQ deployment job with optional deduplication `jobId`.
 * Returns `{ queued: true, jobId }` when Redis/BullMQ is active, or `{ queued: false }`
 * so the caller can run the in-process build fallback cleanly.
 */
export async function enqueueDeployJob(
  payload: DeployJobPayload,
  dedupeKey?: string,
): Promise<{ queued: boolean; jobId?: string }> {
  const queue = await getDeployQueue();
  if (!queue) return { queued: false };
  try {
    const jobId = dedupeKey
      ? dedupeKey.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 96)
      : `${payload.kind}-${payload.projectId}-${payload.deploymentId}`;
    const job = await queue.add(payload.kind, payload, { jobId });
    return { queued: true, ...(job.id ? { jobId: String(job.id) } : {}) };
  } catch {
    return { queued: false };
  }
}

/**
 * Publishes a real-time deployment log line to both Redis Pub/Sub (multi-node SSE)
 * and the local EventEmitter (single-node dev/fallback).
 */
export async function publishDeployLog(entry: StreamedDeployLog): Promise<void> {
  const channel = deployLogChannel(entry.deploymentId);
  localLogBus.emit(channel, entry);
  const pub = await getPublisher();
  if (pub) {
    await pub.publish(channel, JSON.stringify(entry)).catch(() => {});
  }
}

/**
 * Subscribes to live deployment log events for an SSE stream and returns an unsubscribe cleanup.
 */
export async function subscribeDeployLogs(
  deploymentId: string,
  onMessage: (entry: StreamedDeployLog) => void,
): Promise<() => Promise<void>> {
  const channel = deployLogChannel(deploymentId);
  const url = getRedisUrl();

  if (url) {
    try {
      const { default: IORedis } = await import("ioredis");
      const sub = new IORedis(url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
      sub.on("error", () => {});
      sub.on("message", (_ch, raw) => {
        try {
          onMessage(JSON.parse(raw) as StreamedDeployLog);
        } catch {
          // ignore malformed payload
        }
      });
      await sub.subscribe(channel);
      return async () => {
        await sub.unsubscribe(channel).catch(() => {});
        sub.disconnect();
      };
    } catch {
      // fall through to local EventEmitter
    }
  }

  localLogBus.on(channel, onMessage);
  return async () => {
    localLogBus.off(channel, onMessage);
  };
}
