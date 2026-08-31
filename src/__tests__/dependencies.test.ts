import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Dependencies that no longer have a caller.
 *
 * `dependencies` is installed on every production deploy and traced into the serverless
 * bundle, so an entry nothing imports is weight and supply-chain surface for nothing.
 * Three of them survived the teardown of the server-side video pipeline and the blob
 * uploads, and were only found by reading the list against the source.
 */

/** Used without ever being named in source: React's renderer, resolved by Next itself. */
const USED_WITHOUT_AN_IMPORT = new Set(["react-dom"]);

function repoFiles(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|mjs|cjs|css)$/.test(entry.name)) out.push(full);
    }
  })(".");
  return out;
}

const SOURCE = repoFiles().map((f) => readFileSync(f, "utf8")).join("\n");

/** Every way this repo names a package: ES import, require, bare side-effect import, CSS. */
function isReferenced(pkg: string): boolean {
  const p = pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(from|import|require\\(|@import|@plugin)\\s*\\(?["']${p}(["'/])`).test(SOURCE);
}

describe("every runtime dependency has a caller", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));

  for (const name of Object.keys(pkg.dependencies)) {
    if (USED_WITHOUT_AN_IMPORT.has(name)) continue;
    it(`${name} is imported somewhere`, () => {
      expect(isReferenced(name), `${name} is in dependencies but nothing imports it`).toBe(true);
    });
  }
});
