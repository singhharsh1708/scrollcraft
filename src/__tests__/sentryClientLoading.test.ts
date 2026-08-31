import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The client Sentry SDK must not be a static import.
 *
 * `enabled: !!dsn` stopped it reporting, not shipping. Measured over the wire against a
 * production build with no DSN, which is how this project and every fork of it is
 * configured: /privacy fell from 347.5 KiB of JS to 283.6 KiB once the SDK left the
 * initial graph. NEXT_PUBLIC_ values are inlined at build time, so the branch guarding
 * the dynamic import compiles away entirely.
 */

function clientFiles(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "__tests__") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
  })("src");
  // Server modules may import it however they like: none of it reaches a browser.
  const serverOnly = ["src/lib/logger.ts", "src/instrumentation.ts"];
  return out.filter((f) => !serverOnly.includes(f));
}

const STATIC_IMPORT = /^\s*import\s[^;]*from\s+["']@sentry\/nextjs["']/m;

describe("the client Sentry SDK is loaded, not shipped", () => {
  it("is never a static import in anything that reaches the browser", () => {
    const offenders = clientFiles().filter((f) => STATIC_IMPORT.test(readFileSync(f, "utf8")));
    expect(offenders, "a static import puts the whole SDK in the initial bundle").toEqual([]);
  });

  it("only imports it when a DSN exists at build time", () => {
    const client = readFileSync("src/instrumentation-client.ts", "utf8");
    expect(client).toContain("const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;");
    expect(client).toMatch(/if \(dsn\) \{\s*\n\s*import\("@sentry\/nextjs"\)/);
  });

  it("still exports the router transition hook Next calls synchronously", () => {
    // Without this export, client-side navigations are missing from traces. It cannot
    // await the import, so it forwards once the SDK has arrived.
    const client = readFileSync("src/instrumentation-client.ts", "utf8");
    expect(client).toContain("export const onRouterTransitionStart");
    expect(client).toContain("capture?.(href, navigationType)");
  });

  it("never lets a failed report replace the error the user is looking at", () => {
    expect(readFileSync("src/lib/captureClientError.ts", "utf8")).toContain(".catch(");
    expect(readFileSync("src/instrumentation-client.ts", "utf8")).toContain(".catch(");
  });

  it("does not tell the user they have been notified when nobody has", () => {
    // With no DSN, and that is the default, nothing is reported anywhere.
    const boundaries = ["src/app/global-error.tsx", "src/app/create/error.tsx", "src/app/editor/error.tsx"];
    for (const f of boundaries) {
      expect(readFileSync(f, "utf8"), `${f} promises a report that may never be sent`)
        .not.toMatch(/been notified|looking into it/i);
    }
  });
});
