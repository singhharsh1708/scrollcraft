"use client";

const DB_NAME = "scrollcraft";
const STORE_NAME = "frames";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    // Without this a version bump held open by another tab hangs here forever.
    req.onblocked = () => reject(new Error("IndexedDB upgrade blocked by another tab"));
  });
}

// A transaction can abort without any request error — storage eviction, the connection
// being force-closed, a versionchange from another tab. Handling only onerror left these
// promises permanently pending, which stalled callers behind an await that never settled.
function settle<T>(
  db: IDBDatabase,
  tx: IDBTransaction,
  resolve: (v: T) => void,
  reject: (e: unknown) => void,
  getValue: () => T
) {
  tx.oncomplete = () => { db.close(); resolve(getValue()); };
  tx.onerror = () => { db.close(); reject(tx.error); };
  tx.onabort = () => { db.close(); reject(tx.error ?? new Error("IndexedDB transaction aborted")); };
}

export async function storeFrames(key: string, frames: string[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(frames, key);
    settle(db, tx, resolve, reject, () => undefined);
  });
}

export async function loadFrames(key: string): Promise<string[] | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    settle(db, tx, resolve, reject, () => (Array.isArray(req.result) ? req.result : null));
  });
}

export async function deleteFrames(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    settle(db, tx, resolve, reject, () => undefined);
  });
}
