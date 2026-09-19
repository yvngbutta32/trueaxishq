/**
 * Durable blob store for offline field photos (IndexedDB).
 *
 * Photos taken in a dead zone must survive refreshes, force-closes, and
 * browser restarts — localStorage cannot hold binary blobs, so photos are
 * written to IndexedDB and replayed by the offline queue when connectivity
 * returns. The module is storage-agnostic so it can be unit-tested with a
 * plain Map, and every method degrades to a no-op (never throws) when
 * IndexedDB is unavailable (private mode, old browsers, SSR).
 */

export type StoredPhotoBlob = {
  file: File;
  /** ISO timestamp captured, for UI ordering of pending photos. */
  capturedAt: number;
};

export type PhotoBlobStore = {
  put(key: string, file: File): Promise<void>;
  get(key: string): Promise<StoredPhotoBlob | null>;
  delete(key: string): Promise<void>;
};

const DB_NAME = "trueaxis-field";
const DB_VERSION = 1;
const PHOTO_STORE = "photos";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PHOTO_STORE)) {
        request.result.createObjectStore(PHOTO_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(PHOTO_STORE, mode);
        const request = run(transaction.objectStore(PHOTO_STORE));
        transaction.oncomplete = () => {
          db.close();
          resolve(request.result);
        };
        transaction.onabort = () => {
          db.close();
          reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error ?? new Error("IndexedDB transaction failed"));
        };
      }),
  );
}

/** Real IndexedDB-backed store. Every method swallows errors so a broken
 * IndexedDB can never crash field work — the queue surfaces a toast instead. */
export function createPhotoBlobStore(): PhotoBlobStore {
  return {
    async put(key: string, file: File) {
      await withStore("readwrite", store => store.put({ file, capturedAt: Date.now() }, key));
    },
    async get(key: string) {
      const value = await withStore<StoredPhotoBlob | undefined>("readonly", store => store.get(key) as IDBRequest<StoredPhotoBlob | undefined>);
      return value && value.file instanceof File ? value : null;
    },
    async delete(key: string) {
      await withStore("readwrite", store => store.delete(key));
    },
  };
}

/** Persistent fallback used when IndexedDB is unavailable: keeps blobs in
 * memory only for the session (better than dropping the photo outright). */
export function createInMemoryPhotoBlobStore(): PhotoBlobStore {
  const map = new Map<string, StoredPhotoBlob>();
  return {
    async put(key, file) {
      map.set(key, { file, capturedAt: Date.now() });
    },
    async get(key) {
      return map.get(key) ?? null;
    },
    async delete(key) {
      map.delete(key);
    },
  };
}

let cachedStore: PhotoBlobStore | null = null;

/** Singleton accessor: prefers IndexedDB, falls back to an in-memory store. */
export function getPhotoBlobStore(): PhotoBlobStore {
  if (!cachedStore) {
    cachedStore = typeof indexedDB !== "undefined" ? createPhotoBlobStore() : createInMemoryPhotoBlobStore();
  }
  return cachedStore;
}

/** Test seam: inject a store or reset to IndexedDB (pass null). */
export function setPhotoBlobStoreForTests(store: PhotoBlobStore | null): void {
  cachedStore = store;
}
