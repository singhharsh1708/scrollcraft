import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Zod reaches the browser through siteSchema, which the editor and the gallery both use
 * to validate URL parameters and stored JSON.
 *
 * `import { z } from "zod"` binds a namespace object, so the bundler keeps it whole —
 * including `z.locales`, all 53 of them. Measured over the wire against production
 * builds: importing the schema constructors by name instead took /templates from 466.1
 * to 424.5 KiB of JS and /editor from 452.9 to 411.3 KiB, and left no chunk in the build
 * containing a translated validation message.
 */

function sourceFiles(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "__tests__") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
  })("src");
  return out;
}

/** Server-only by declaration: nothing here is bundled for a browser. */
const SERVER_ONLY = new Set(["src/lib/env.ts"]);

// Anchored to the start of a line so prose about the old form does not match.
const NAMESPACE_IMPORT = /^import\s+(\{\s*z\s*\}|\*\s+as\s+z)\s+from\s+["']zod["']/m;

describe("zod does not drag its locales into the browser", () => {
  it("has at least one module importing zod, so this is not vacuous", () => {
    const users = sourceFiles().filter((f) => /from\s+["']zod["']/.test(readFileSync(f, "utf8")));
    expect(users.length).toBeGreaterThan(0);
  });

  it("binds no zod namespace in anything that reaches the browser", () => {
    const offenders = sourceFiles().filter(
      (f) => !SERVER_ONLY.has(f) && NAMESPACE_IMPORT.test(readFileSync(f, "utf8"))
    );
    expect(offenders, "a namespace import keeps z.locales in the bundle").toEqual([]);
  });

  it("keeps the module that does bind one out of the browser by declaration", () => {
    for (const f of SERVER_ONLY) {
      // Not a convention: `import "server-only"` is a hard build error if a client
      // component reaches it, which is the only thing making the exemption above safe.
      expect(readFileSync(f, "utf8"), `${f} is exempt but not server-only`)
        .toMatch(/^import "server-only";/m);
    }
  });

  it("still validates the shapes it always did", async () => {
    const { themeSchema, siteStyleSchema } = await import("@/lib/siteSchema");
    expect(themeSchema.safeParse({ scale: "poster", displayWeight: 700 }).success).toBe(true);
    expect(themeSchema.safeParse({ scale: "enormous" }).success).toBe(false);
    expect(themeSchema.safeParse({ displayWeight: 1200 }).success).toBe(false);
    expect(siteStyleSchema.safeParse({ style: "gradient", colors: ["#fff", "#000", "#123456"] }).success).toBe(true);
    expect(siteStyleSchema.safeParse({ style: "gradient", colors: ["#fff", "#000"] }).success).toBe(false);
    expect(siteStyleSchema.safeParse({ style: "not-a-style", colors: ["#fff", "#000", "#111"] }).success).toBe(false);
  });
});
