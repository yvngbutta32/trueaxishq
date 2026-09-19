/**
 * Durable offline write queue for Field Mode (ServiceM8-style offline parity).
 *
 * Field technicians lose connectivity mid-job. Instead of blocking writes, we
 * queue them locally and replay sequentially once the browser reports online.
 * The module is storage-agnostic so it can be unit-tested with a plain Map.
 */

export type QueuedOperationKind = "update" | "photo";

export type QueuedOperation = {
  id: string;
  /** Trpc procedure path, e.g. "jobs.addUpdate". */
  proc: string;
  payload: unknown;
  queuedAt: number;
  attempts: number;
  /** Coarse UI category so the sync banner can say "2 updates and 1 photo".
   * Optional for backwards compatibility with queues persisted by older
   * builds, which load as plain updates. */
  kind?: QueuedOperationKind;
};

export type QueueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const QUEUE_KEY = "trueaxis-field-queue";
export const MAX_QUEUE_SIZE = 50;
export const MAX_ATTEMPTS = 5;

/** A window-safe localStorage shim (private mode, quota, SSR). */
export function safeBrowserStorage(): QueueStorage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = "__trueaxis_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadQueue(storage: QueueStorage | null): QueuedOperation[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is QueuedOperation =>
      typeof entry === "object" && entry !== null &&
      typeof (entry as QueuedOperation).id === "string" &&
      typeof (entry as QueuedOperation).proc === "string" &&
      typeof (entry as QueuedOperation).attempts === "number");
  } catch {
    return [];
  }
}

export function saveQueue(storage: QueueStorage | null, queue: QueuedOperation[]): void {
  if (!storage) return;
  try {
    if (queue.length === 0) storage.removeItem(QUEUE_KEY);
    else storage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)));
  } catch {
    // Quota errors drop persistence for this session; in-memory queue still works.
  }
}

let nextSequence = 0;
export function enqueueOperation(
  queue: QueuedOperation[],
  proc: string,
  payload: unknown,
  now = Date.now(),
  kind: QueuedOperationKind = "update",
): QueuedOperation[] {
  if (queue.length >= MAX_QUEUE_SIZE) queue = queue.slice(1);
  nextSequence += 1;
  const operation: QueuedOperation = {
    id: `${now}-${nextSequence}`,
    proc,
    payload,
    queuedAt: now,
    attempts: 0,
    kind,
  };
  return [...queue, operation];
}

export type ReplayExecutor = (proc: string, payload: unknown) => Promise<unknown>;
export type ReplayResult = {
  synced: number;
  dropped: number;
  remaining: QueuedOperation[];
};

/** Pending counts per kind, for the visible sync-state banner. */
export function countByKind(queue: QueuedOperation[]): { updates: number; photos: number } {
  let updates = 0;
  let photos = 0;
  for (const operation of queue) {
    if (operation.kind === "photo") photos += 1;
    else updates += 1;
  }
  return { updates, photos };
}

/**
 * Replays queued operations one at a time, in order. An operation that fails is
 * retried on the next replay (up to MAX_ATTEMPTS total, then it is dropped so a
 * permanently bad operation can never wedge the queue).
 */
export async function replayQueue(queue: QueuedOperation[], executor: ReplayExecutor): Promise<ReplayResult> {
  const remaining: QueuedOperation[] = [];
  let synced = 0;
  let dropped = 0;

  for (const operation of queue) {
    try {
      await executor(operation.proc, operation.payload);
      synced += 1;
    } catch {
      const attempts = operation.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) dropped += 1;
      else remaining.push({ ...operation, attempts });
    }
  }
  return { synced, dropped, remaining };
}
