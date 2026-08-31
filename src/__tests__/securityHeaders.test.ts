import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The Content-Security-Policy, read from next.config.ts.
 *
 * It is the one piece of the payment integration that survived its removal: the policy
 * still let a payment processor run scripts, be framed, and be talked to, on every page
 * of an app that no longer takes money. A policy is only as good as its narrowest
 * directive, so the checks below are about what it does *not* allow.
 */
const CONFIG = readFileSync("next.config.ts", "utf8");

const directives: Record<string, string> = Object.fromEntries(
  [...CONFIG.matchAll(/^\s*"([a-z-]+) ([^"]*)",\s*$/gm)]
    .filter(([, name]) => name.includes("-src") || name.startsWith("frame-") || name.startsWith("base-") || name.startsWith("form-"))
    .map(([, name, value]) => [name, value])
);

describe("the content security policy", () => {
  it("was parsed out of the config at all", () => {
    // If the shape of the config changes, every assertion below would pass vacuously.
    expect(Object.keys(directives)).toContain("default-src");
    expect(Object.keys(directives).length).toBeGreaterThan(6);
  });

  it("names no payment processor", () => {
    // Razorpay held script-src, connect-src and frame-src grants. Payments were removed;
    // the grants were not, so a third party kept permission to execute on every page.
    const offenders = Object.entries(directives).filter(([, value]) =>
      /razorpay|stripe|lemonsqueezy|paypal|checkout\./i.test(value)
    );
    expect(offenders, "a payment host is still allowed").toEqual([]);
  });

  it("allows scripts only from this origin", () => {
    const hosts = directives["script-src"].split(/\s+/).filter((t) => !t.startsWith("'"));
    expect(hosts, "script-src names a third-party host").toEqual([]);
  });

  it("frames nothing and may not be framed", () => {
    expect(directives["frame-src"]).toBe("'none'");
    expect(directives["frame-ancestors"]).toBe("'none'");
  });

  it("closes the directives that do not fall back to default-src", () => {
    // base-uri and form-action are not covered by default-src: without them a single
    // injected tag can retarget every relative URL or every form post on the page.
    expect(directives["base-uri"]).toBe("'self'");
    expect(directives["form-action"]).toBe("'self'");
    expect(directives["object-src"]).toBe("'none'");
  });
});

describe("the transport and framing headers", () => {
  it("keeps the ones a scanner checks for", () => {
    for (const header of [
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Strict-Transport-Security",
    ]) {
      expect(CONFIG, `${header} is no longer sent`).toContain(header);
    }
  });

  it("applies them to every route, not just the pages", () => {
    expect(CONFIG).toContain('source: "/(.*)", headers: securityHeaders');
  });
});

describe("nothing in the app still talks to a payment processor", () => {
  it("has no client that would need the grants back", () => {
    const out: string[] = [];
    (function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
      }
    })("src");
    const offenders = out.filter((f) => {
      const t = readFileSync(f, "utf8");
      // The changelog records the removal by name, which is not a caller.
      return /razorpay|lemonsqueezy/i.test(t) && !f.includes("changelog") && !f.includes("__tests__");
    });
    expect(offenders).toEqual([]);
  });
});
