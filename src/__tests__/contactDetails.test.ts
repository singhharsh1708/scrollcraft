import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONTACT_EMAIL,
  GITHUB_REPO_URL,
  GITHUB_PROFILE_URL,
  GITHUB_SPONSORS_URL,
  LINKEDIN_URL,
  AUTHOR_SITE_URL,
} from "@/lib/links";

/**
 * The site once advertised hello@ and enterprise@ addresses at scrollcraft.app — a domain
 * owned by an unrelated product, with live mail routing. Deletion requests, billing
 * questions and enterprise enquiries were being delivered to a stranger. These pin the
 * details so that cannot come back.
 */

function sourceFiles(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "generated" || entry.name === "__tests__") continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        out.push(full);
      }
    }
  })("src");
  return out;
}

const FILES = sourceFiles();

describe("contact details are real", () => {
  it("uses an address on a domain that can actually receive the mail", () => {
    expect(CONTACT_EMAIL).toBe("hs1663531@gmail.com");
  });

  it("never references a scrollcraft.app mailbox anywhere in the app", () => {
    // That domain belongs to someone else, so mail sent there reaches a third party.
    const offenders = FILES.filter((f) => /@scrollcraft\.app/.test(readFileSync(f, "utf8")));
    expect(offenders, "found an email address on a domain we do not own").toEqual([]);
  });

  it("does not point users at scrollcraft.app as if it were this product", () => {
    const offenders = FILES.filter((f) => {
      const body = readFileSync(f, "utf8");
      // Allow prose that explains the situation; forbid it being used as a live URL.
      return /https:\/\/scrollcraft\.app/.test(body) && !body.includes("belongs to someone else");
    });
    expect(offenders, "found a link to an unrelated product's domain").toEqual([]);
  });

});

describe("profile links point at the real accounts", () => {
  it("uses the owner's actual handles", () => {
    expect(GITHUB_REPO_URL).toBe("https://github.com/singhharsh1708/scrollcraft");
    expect(GITHUB_PROFILE_URL).toBe("https://github.com/singhharsh1708");
    expect(GITHUB_SPONSORS_URL).toBe("https://github.com/sponsors/singhharsh1708");
    expect(LINKEDIN_URL).toBe("https://linkedin.com/in/singhharsh1708");
    expect(AUTHOR_SITE_URL).toBe("https://singhharsh.in");
  });

  it("keeps every outbound link on https", () => {
    for (const url of [GITHUB_REPO_URL, GITHUB_PROFILE_URL, GITHUB_SPONSORS_URL, LINKEDIN_URL, AUTHOR_SITE_URL]) {
      expect(url).toMatch(/^https:\/\//);
    }
  });
});

describe("the site does not claim things it cannot do", () => {
  it("does not advertise a live chat channel", () => {
    // There is no chat widget and no staffed support hours.
    const offenders = FILES.filter((f) => /Live chat|Chat in the app/.test(readFileSync(f, "utf8")));
    expect(offenders, "found a live chat claim with nothing behind it").toEqual([]);
  });

  it("carries no testimonials, since there are no customers to quote", () => {
    const offenders = FILES.filter((f) => /TESTIMONIALS|From our users/.test(readFileSync(f, "utf8")));
    expect(offenders, "found testimonial content").toEqual([]);
  });

  it("does not publish a personal phone number", () => {
    // Deliberate: a mobile number on a public page is scraped within days, and it is
    // far easier to add later than to un-publish.
    const offenders = FILES.filter((f) => /9879348760|\+91[\s-]?98793/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("shows no third-party credential badge that cannot be verified", () => {
    // The Product Hunt widget takes a numeric post_id; the site passed the slug
    // "scrollcraft", which returns a generic badge whether or not a listing exists.
    // A featured badge with nothing behind it is a fabricated endorsement.
    const offenders = FILES.filter((f) => /producthunt\.com/.test(readFileSync(f, "utf8")));
    expect(offenders, "found an unverified credential badge").toEqual([]);
  });

  it("promises no response time it cannot keep, and no channel it does not have", () => {
    const claims = [/typically reply within/i, /tag us on Twitter/i, /24\/7/, /Mon–Fri/];
    for (const claim of claims) {
      const offenders = FILES.filter((f) => claim.test(readFileSync(f, "utf8")));
      expect(offenders, `found an unsupported support claim: ${claim}`).toEqual([]);
    }
  });
});

describe("a fork resolves its own origin", () => {
  it("does not hardcode the maintainer's deployment in anything a fork ships", () => {
    // A fork's exported READMEs, social cards and canonical URLs must point at the fork,
    // not at whoever published first. env.ts keeps one last-resort fallback; nothing else
    // may name a specific deployment.
    const offenders = FILES.filter((f) => {
      if (f.endsWith("src/lib/env.ts")) return false;
      return /scrollcraft-gilt\.vercel\.app/.test(readFileSync(f, "utf8"));
    });
    expect(offenders, "found a hardcoded deployment URL").toEqual([]);
  });

  it("resolves the origin from configuration before falling back", () => {
    const env = readFileSync("src/lib/env.ts", "utf8");
    expect(env).toContain("env.SITE_URL");
    expect(env).toContain("VERCEL_PROJECT_PRODUCTION_URL");
  });
});

/**
 * Numbers and capabilities the site publishes about itself.
 *
 * Every one of these was wrong at some point after the open-source pivot: the README's
 * opening paragraph still sold 8 of the 21 templates and advertised a publishing feature
 * removed in v1.0.0, the presets page promised an AI that no longer exists, and the
 * about page promised a weekly release cadence the changelog contradicts.
 */
describe("what the site claims about itself is true", () => {
  const README = readFileSync("README.md", "utf8");
  const TEMPLATES_SRC = readFileSync("src/lib/templates.ts", "utf8");

  const templateCount = (TEMPLATES_SRC.match(/^ {4}slug: "/gm) ?? []).length;
  const categoryCount = new Set(
    [...TEMPLATES_SRC.matchAll(/^ {4}category: "([^"]+)"/gm)].map((m) => m[1])
  ).size;

  it("counted the catalogue at all, so the assertions below are not vacuous", () => {
    expect(templateCount).toBeGreaterThan(10);
    expect(categoryCount).toBeGreaterThan(3);
  });

  it("quotes the real template and category counts in the README", () => {
    const line = README.split("\n").find((l) => l.includes("Template library"));
    expect(line, "the README feature bullet is gone").toBeTruthy();
    expect(line).toContain(`${templateCount} finished scroll sites`);
    expect(line).toContain(`${categoryCount} categories`);
  });

  it("sells nothing, anywhere", () => {
    for (const [label, text] of [
      ["README", README],
      ["terms", readFileSync("src/app/terms/page.tsx", "utf8")],
      ["contact", readFileSync("src/app/contact/page.tsx", "utf8")],
    ] as const) {
      expect(text, `${label} still offers something for sale`).not.toMatch(
        /bought once|are paid|paid templates|premium template|"Billing"/i
      );
    }
  });

  it("promises no AI, which the product does not have", () => {
    // The changelog records its removal by name, so it is the one file allowed to say it.
    for (const file of ["README.md", "src/app/presets/page.tsx", "src/app/HomeClient.tsx", "src/app/create/page.tsx", "src/app/about/page.tsx"]) {
      expect(readFileSync(file, "utf8"), `${file} advertises AI`).not.toMatch(
        /\bthe AI\b|AI generates|AI-generated|AI-powered/i
      );
    }
  });

  it("promises no release cadence it does not keep", () => {
    expect(readFileSync("src/app/about/page.tsx", "utf8")).not.toMatch(
      /release weekly|every single week|ship daily|weekly releases/i
    );
  });

  it("does not imply a paid tier that does not exist", () => {
    // There is no checkout, no account and no plan, so "free plan", "no credit card"
    // and "start for free" all answered a question nobody was asked and implied tiers.
    // templates.ts is exempt: its section copy is sample content for fictional sites.
    const offenders = sourceFiles()
      .filter((f) => !f.includes("templates.ts") && !f.includes("changelog"))
      .filter((f) => /free plan|no credit card|start for free|start free/i.test(readFileSync(f, "utf8")));
    expect(offenders, "the site still talks like it has pricing").toEqual([]);
  });

  it("describes the rate limiting it actually applies", () => {
    // One of three API routes is rate-limited; the privacy page promised two.
    const privacy = readFileSync("src/app/privacy/page.tsx", "utf8");
    expect(privacy).not.toContain("rate-limit the two API routes");
    const limited = readdirSync("src/app/api", { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .filter((d) => readFileSync(join("src/app/api", d.name, "route.ts"), "utf8").includes("rateLimit("));
    expect(limited.map((d) => d.name)).toEqual(["export-site"]);
  });

  it("keeps the legal pages dated to when they were last rewritten", () => {
    // They described the August teardown while dated June, which reads as unmaintained.
    for (const file of ["src/app/terms/page.tsx", "src/app/cookies/page.tsx", "src/app/privacy/page.tsx"]) {
      const text = readFileSync(file, "utf8");
      const stamp = /Last updated: ([A-Z][a-z]+ \d{4})/.exec(text);
      expect(stamp, `${file} has no Last updated line`).toBeTruthy();
      expect(stamp![1], `${file} predates the open-source rewrite`).not.toBe("June 2026");
    }
  });
});
