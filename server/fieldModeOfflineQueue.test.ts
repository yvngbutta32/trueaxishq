import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  countByKind,
  enqueueOperation,
  loadQueue,
  MAX_ATTEMPTS,
  MAX_QUEUE_SIZE,
  QUEUE_KEY,
  replayQueue,
  saveQueue,
  type QueueStorage,
} from "../client/src/lib/offlineQueue";
import { createInMemoryPhotoBlobStore, setPhotoBlobStoreForTests } from "../client/src/lib/photoStore";

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

  it("carries the operation kind through storage so the banner can break down photos vs updates", () => {
    const storage = memoryStorage();
    let queue = enqueueOperation([], "jobs.addUpdate", { jobId: 5, message: "Update" }, 1000);
    queue = enqueueOperation(queue, "photos.captureProof", { blobKey: "photo-1" }, 2000, "photo");
    expect(countByKind(queue)).toEqual({ updates: 1, photos: 1 });
    saveQueue(storage, queue);
    const persisted = loadQueue(storage);
    expect(countByKind(persisted)).toEqual({ updates: 1, photos: 1 });
    // Older builds persisted queues without a kind — they load as updates.
    const legacy = JSON.stringify([{ id: "a-1", proc: "jobs.addUpdate", payload: {}, queuedAt: 1, attempts: 0 }]);
    expect(countByKind(loadQueue(memoryStorage({ [QUEUE_KEY]: legacy })))).toEqual({ updates: 1, photos: 0 });
  });

  it("replays queued photos through the dedicated photo executor", async () => {
    let queue = enqueueOperation([], "photos.captureProof", { jobId: 7, blobKey: "photo-1" }, 1000, "photo");
    queue = enqueueOperation(queue, "jobs.addUpdate", { jobId: 7, message: "Done" }, 2000);
    const calls: Array<[string, unknown]> = [];
    const result = await replayQueue(queue, async (proc, payload) => {
      calls.push([proc, payload]);
    });
    expect(result).toEqual({ synced: 2, dropped: 0, remaining: [] });
    expect(calls[0]).toEqual(["photos.captureProof", { jobId: 7, blobKey: "photo-1" }]);
    expect(result).toBeTruthy();
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
  const sharedSource = () => readFileSync(resolve(import.meta.dirname, "../shared/fieldModeRecovery.ts"), "utf8");
  const routerSource = () => readFileSync(resolve(import.meta.dirname, "./routers.ts"), "utf8");
  const schemaSource = () => readFileSync(resolve(import.meta.dirname, "../drizzle/schema.ts"), "utf8");
  const migrationSource = () => {
    const dir = readdirSync(resolve(import.meta.dirname, "../drizzle"));
    const migration = dir.filter(name => name.endsWith(".sql") && name.startsWith("0067_")).map(name => readFileSync(resolve(import.meta.dirname, "../drizzle", name), "utf8")).join("");
    return migration;
  };

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

  it("captures photos offline into the durable blob store and auto-uploads them on reconnect", () => {
    // Capture stays available while offline (no disabled={!isOnline} gate on the capture buttons).
    expect(fieldModeSource).toContain("onClick={() => cameraRef.current?.click()} disabled={isUploading}");
    expect(fieldModeSource).toContain("queuePhotoOffline");
    expect(fieldModeSource).toContain('queueOperation("photos.captureProof", payload, "photo")');
    expect(fieldModeSource).toContain("await store.put(blobKey, file)");
    // A connection drop mid-upload parks the photo in the queue instead of losing it.
    expect(fieldModeSource).toContain("await queuePhotoOffline(file);");
    // Replay runs the upload -> confirm -> attach -> cleanup chain.
    expect(hookSource).toContain("if (proc === \"photos.captureProof\")");
    expect(hookSource).toContain("await replayPhoto(payload as PendingPhotoPayload)");
    expect(fieldModeSource).toContain("await store.delete(payload.blobKey);");
  });

  it("stores offline blobs durably and survives restarts (photoStore contract)", async () => {
    const store = createInMemoryPhotoBlobStore();
    setPhotoBlobStoreForTests(store);
    const file = new File(["proof-bytes"], "proof.png", { type: "image/png" });
    await store.put("photo-1", file);
    const restored = await store.get("photo-1");
    expect(restored?.file.size).toBe(file.size);
    expect(restored && typeof restored.capturedAt).toBe("number");
    await store.delete("photo-1");
    expect(await store.get("photo-1")).toBeNull();
    expect(await store.get("missing")).toBeNull();
    setPhotoBlobStoreForTests(null);
  });

  it("makes offline addUpdate replays idempotent so a retried update never double-posts", () => {
    expect(fieldModeSource).toContain('clientRequestId: randomRequestId("update")');
    expect(routerSource()).toContain("clientRequestId: z.string().min(8).max(64).optional()");
    expect(routerSource()).toContain("eq(jobActivities.clientRequestId, input.clientRequestId)");
    expect(routerSource()).toContain("replayed: true");
    expect(routerSource()).toMatch(/Duplicate entry/);
  });

  it("adds the idempotency column with a unique replay index", () => {
    expect(schemaSource()).toContain('clientRequestId: varchar("clientRequestId", { length: 64 })');
    expect(schemaSource()).toContain('uniqueIndex("jobActivities_userId_clientRequestId_unique_idx")');
    expect(migrationSource()).toContain("ADD `clientRequestId` varchar(64)");
    expect(migrationSource()).toContain("UNIQUE(`userId`,`clientRequestId`)");
  });

  it("keeps drafts on the device across restarts instead of the session", () => {
    expect(fieldModeSource).toContain("saveFieldModeDraft(jobId, value)");
    expect(fieldModeSource).toContain("loadFieldModeDraft(jobId)");
    expect(sharedSource()).toContain("window.localStorage.getItem(fieldModeDraftKey(jobId))");
  });

  it("shows a per-kind breakdown in the sync banner", () => {
    expect(fieldModeSource).toContain("pendingByKind.photos");
    expect(fieldModeSource).toContain("pendingByKind.updates");
    expect(hookSource).toContain("countByKind(queue)");
  });

  it("replays through the trpc client and invalidates job data after a sync", () => {
    expect(hookSource).toContain("utils.client.mutation");
    expect(hookSource).toContain("utils.jobs.list.invalidate()");
    expect(hookSource).toContain("navigator.onLine");
  });
});
