import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  enqueueOperation,
  loadQueue,
  MAX_ATTEMPTS,
  MAX_QUEUE_SIZE,
  QUEUE_KEY,
  replayQueue,
  saveQueue,
  type QueueStorage,
} from "../client/src/lib/offlineQueue";

/** In-memory storage shim so the queue logic runs without a browser. */
function memoryStorage(initial: Record<string, string> = {}): QueueStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    removeItem: key => { map.delete(key); },
  };
}

describe("Field Mode offline queue", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("enqueues in FIFO order and keeps payloads intact", () => {
    let queue = enqueueOperation([], "jobs.updateTask", { id: 1, status: "done" });
    queue = enqueueOperation(queue, "jobs.addUpdate", { jobId: 5, message: "Arrived" });
    expect(queue.map(op => op.proc)).toEqual(["jobs.updateTask", "jobs.addUpdate"]);
    expect(queue[0].payload).toEqual({ id: 1, status: "done" });
    expect(queue[0].attempts).toBe(0);
  });

  it("caps the queue so a long outage cannot grow it without bound", () => {
    let queue: ReturnType<typeof enqueueOperation> = [];
    for (let i = 0; i < MAX_QUEUE_SIZE + 10; i++) queue = enqueueOperation(queue, "jobs.updateTask", { i });
    expect(queue).toHaveLength(MAX_QUEUE_SIZE);
    // Oldest operations were evicted; the newest survive.
    expect((queue[0].payload as { i: number }).i).toBe(10);
  });

  it("round-trips through storage and clears the key when empty", () => {
    const storage = memoryStorage();
    const queue = enqueueOperation([], "jobs.addUpdate", { jobId: 5, message: "Poured footings" });
    saveQueue(storage, queue);
    expect(loadQueue(storage)).toHaveLength(1);
    saveQueue(storage, []);
    expect(storage.getItem(QUEUE_KEY)).toBeNull();
    expect(loadQueue(storage)).toEqual([]);
  });

  it("tolerates corrupt and malformed persisted queues", () => {
    expect(loadQueue(memoryStorage({ [QUEUE_KEY]: "{not json" }))).toEqual([]);
    expect(loadQueue(memoryStorage({ [QUEUE_KEY]: JSON.stringify([{ id: 1 }]) }))).toEqual([]);
    expect(loadQueue(memoryStorage({ [QUEUE_KEY]: JSON.stringify(["nope", null]) }))).toEqual([]);
    expect(loadQueue(null)).toEqual([]);
  });

  it("replays successfully in order and empties the queue", async () => {
    let queue = enqueueOperation([], "jobs.updateTask", { id: 1, status: "done" }, 1000);
    queue = enqueueOperation(queue, "jobs.addUpdate", { jobId: 5, message: "Half done" }, 2000);
    const calls: Array<[string, unknown]> = [];
    const result = await replayQueue(queue, async (proc, payload) => {
      calls.push([proc, payload]);
    });
    expect(result).toEqual({ synced: 2, dropped: 0, remaining: [] });
    expect(calls).toEqual([
      ["jobs.updateTask", { id: 1, status: "done" }],
      ["jobs.addUpdate", { jobId: 5, message: "Half done" }],
    ]);
  });

  it("keeps a failed operation for the next replay and drops it after the attempt cap", async () => {
    let queue = enqueueOperation([], "jobs.addUpdate", { jobId: 5, message: "Retry me" });
    const failing = async () => { throw new Error("still offline"); };

    // Four replays fail: attempts 1..4 keep the operation queued.
    for (let attempt = 1; attempt <= MAX_ATTEMPTS - 1; attempt++) {
      const result = await replayQueue(queue, failing);
      expect(result.synced).toBe(0);
      expect(result.remaining).toHaveLength(1);
      expect(result.remaining[0].attempts).toBe(attempt);
      queue = result.remaining;
    }

    // The fifth failure hits the cap and the operation is discarded.
    const final = await replayQueue(queue, failing);
    expect(final).toEqual({ synced: 0, dropped: 1, remaining: [] });
  });

  it("continues replaying after a failing operation so one bad write cannot wedge the queue", async () => {
    let queue = enqueueOperation([], "jobs.updateTask", { id: 1, status: "done" });
    queue = enqueueOperation(queue, "jobs.addUpdate", { jobId: 5, message: "After the failure" });
    let sawFailure = false;
    const result = await replayQueue(queue, async proc => {
      if (proc === "jobs.updateTask" && !sawFailure) { sawFailure = true; throw new Error("conflict"); }
    });
    expect(result.synced).toBe(1);
    expect(result.remaining.map(op => op.proc)).toEqual(["jobs.updateTask"]);
  });
});

describe("Field Mode queue integration", () => {
  const fieldModeSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/FieldMode.tsx"), "utf8");
  const hookSource = readFileSync(resolve(import.meta.dirname, "../client/src/hooks/useOfflineQueue.ts"), "utf8");

  it("queues checklist toggles and client updates while offline", () => {
    expect(fieldModeSource).toContain('queueOperation("jobs.updateTask"');
    expect(fieldModeSource).toContain('queueOperation("jobs.addUpdate"');
  });

  it("surfaces pending and syncing counts in the connectivity banner", () => {
    expect(fieldModeSource).toContain("pendingCount");
    expect(fieldModeSource).toContain("syncing");
  });

  it("keeps billing-sensitive timer and status writes online-only", () => {
    // Timer start/stop must never be deferred: start/stop timestamps drive billing.
    expect(fieldModeSource).toContain("disabled={!isOnline || startTimer.isPending}");
    expect(fieldModeSource).toContain("disabled={!isOnline || stopTimer.isPending}");
  });

  it("replays through the trpc client and invalidates job data after a sync", () => {
    expect(hookSource).toContain("utils.client.mutation");
    expect(hookSource).toContain("utils.jobs.list.invalidate()");
    expect(hookSource).toContain("navigator.onLine");
  });
});
