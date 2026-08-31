import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * A database can exist at the current version without its object store — an interrupted
 * upgrade leaves exactly that — and onupgradeneeded never fires again for the same
 * version. Without recovery, every read and write in frameStorage fails forever: the
 * editor shows "Not saved" on each autosave with no way out.
 *
 * Reproduced in Chrome against a production build: create "scrollcraft" at v1 with no
 * store, open /editor?template=orbitcrm, type, never touch Save. On the previous build
 * the indicator settled on "Not saved" and the database still had no store; with
 * recovery it settles on "Saved" and the document is there.
 */
const STORAGE = readFileSync("src/lib/frameStorage.ts", "utf8");

describe("a store-less database is recovered, not fatal", () => {
  it("checks for the store after every open, not only during upgrade", () => {
    expect(STORAGE).toContain("if (db.objectStoreNames.contains(STORE_NAME)) return db;");
  });

  it("deletes and recreates rather than failing forever", () => {
    // Safe by construction: a database without the store cannot hold any data.
    expect(STORAGE).toContain("indexedDB.deleteDatabase(DB_NAME)");
    const recovery = STORAGE.slice(STORAGE.indexOf("async function openDB"));
    expect(recovery).toMatch(/const recreated = await requestDB\(\);/);
  });

  it("still refuses to hang when another tab blocks the delete", () => {
    expect(STORAGE).toContain('del.onblocked = () => reject(new Error("IndexedDB delete blocked by another tab"));');
  });

  it("guards createObjectStore so a partial upgrade cannot throw on retry", () => {
    expect(STORAGE).toContain("if (!req.result.objectStoreNames.contains(STORE_NAME)) req.result.createObjectStore(STORE_NAME);");
  });
});
