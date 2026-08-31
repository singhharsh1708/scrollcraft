"use client";

const DB_NAME = "scrollcraft";
const STORE_NAME = "frames";
const DB_VERSION = 1;

function requestDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    // Without this a version bump held open by another tab hangs here forever.
    req.onblocked = () => reject(new Error("IndexedDB upgrade blocked by another tab"));
  });
}

/**
 * A database can exist at the current version without its store — an upgrade that was
 * interrupted partway leaves exactly that. onupgradeneeded never fires again for the
 * same version, so without recovery every read and write in this module fails forever.
 * A store-less database holds nothing, so deleting and recreating it loses nothing.
 */
async function openDB(): Promise<IDBDatabase> {
  const db = await requestDB();
  if (db.objectStoreNames.contains(STORE_NAME)) return db;
  db.close();
  await new Promise<void>((resolve, reject) => {
    const del = indexedDB.deleteDatabase(DB_NAME);
    del.onsuccess = () => resolve();
    del.onerror = () => reject(del.error);
    del.onblocked = () => reject(new Error("IndexedDB delete blocked by another tab"));
  });
  const recreated = await requestDB();
  if (!recreated.objectStoreNames.contains(STORE_NAME)) {
    recreated.close();
    throw new Error("IndexedDB store could not be created");
  }
  return recreated;
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

/**
 * The editor document — everything except the frames, which are stored separately
 * because they are large.
 *
 * With no accounts and no server there is nowhere else for work in progress to live, so
 * "Save" means "keep this in this browser". Deliberately one slot: a single working
 * document is the honest shape for a tool with no account to hang a library off.
 */
export interface StoredDocument {
  name: string;
  description?: string;
  sections: unknown[];
  themeJson?: string | null;
  styleJson?: string | null;
  customHead?: string;
  customCss?: string;
  fps?: number;
  framesKey?: string;
  savedAt: string;
}

const DOCUMENT_KEY = "scrollcraft_document";

export async function storeDocument(doc: StoredDocument): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(doc, DOCUMENT_KEY);
    settle(db, tx, resolve, reject, () => undefined);
  });
}

export async function loadDocument(): Promise<StoredDocument | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(DOCUMENT_KEY);
    settle(db, tx, resolve, reject, () => {
      const v = req.result;
      return v && typeof v === "object" && Array.isArray((v as StoredDocument).sections)
        ? (v as StoredDocument)
        : null;
    });
  });
}

export async function deleteDocument(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(DOCUMENT_KEY);
    settle(db, tx, resolve, reject, () => undefined);
  });
}
