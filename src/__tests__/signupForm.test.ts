import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import { signupForm, signupStatus } from "@/lib/signupForm";
import { sectionSchema } from "@/lib/siteSchema";

const rateLimitMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));

type Handler = typeof import("../app/api/export-site/route").POST;
let POST: Handler;

beforeEach(async () => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ allowed: true });
  ({ POST } = await import("../app/api/export-site/route"));
});

async function exportHtml(sections: unknown[]): Promise<string> {
  const res = await POST(
    new Request("https://scrollcraft.space/api/export-site", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sections, siteName: "Launch", frameCount: 10, fps: 24 }),
    }) as unknown as NextRequest
  );
  expect(res.status).toBe(200);
  return (await res.json()).html as string;
}

/**
 * Collecting an email is the thing people most often glue a second tool on for: one
 * founder's launch page was "carrd.co, mailerlite for wait-list signups", and Carrd puts
 * forms behind its paid tier. An export has no server, so the form posts to the owner's
 * own provider. Each provider's field names come from its own documentation.
 */
describe("the form speaks each provider's language", () => {
  it("posts EMAIL to Mailchimp, with the account and audience it needs", () => {
    const f = signupForm("https://acme.us8.list-manage.com/subscribe/post?u=abc123&id=def456");
    expect(f).toMatchObject({ provider: "Mailchimp", emailName: "EMAIL" });
    expect(f!.hidden).toEqual([["u", "abc123"], ["id", "def456"]]);
  });

  it("posts email_address to Kit, on either of its hostnames", () => {
    for (const host of ["app.convertkit.com", "app.kit.com"]) {
      expect(signupForm(`https://${host}/forms/1234567/subscriptions`)).toMatchObject({ provider: "Kit", emailName: "email_address", hidden: [] });
    }
  });

  it("posts email and embed=1 to Buttondown", () => {
    expect(signupForm("https://buttondown.com/api/emails/embed-subscribe/acme")).toMatchObject({
      provider: "Buttondown", emailName: "email", hidden: [["embed", "1"]],
    });
  });

  it("warns what Formspree and Loops actually do with a signup", () => {
    expect(signupStatus("https://formspree.io/f/xyzabcd")).toMatchObject({ provider: "Formspree", note: expect.stringMatching(/emails you/) });
    expect(signupStatus("https://app.loops.so/api/newsletter-form/clx123")).toMatchObject({ provider: "Loops", note: expect.stringMatching(/JSON/) });
  });

  it("refuses beehiiv rather than shipping a form that cannot work", () => {
    expect(signupStatus("https://embeds.beehiiv.com/abc")).toMatchObject({ kind: "unsupported", provider: "beehiiv" });
    expect(signupForm("https://embeds.beehiiv.com/abc")).toBeNull();
  });

  it("falls back to a field called email for anything else over https", () => {
    expect(signupForm("https://forms.example.com/subscribe")).toMatchObject({ provider: null, emailName: "email", hidden: [] });
  });

  it("will not post a visitor's email anywhere but an https address", () => {
    for (const url of ["http://acme.us8.list-manage.com/subscribe/post", "javascript:alert(1)", "data:text/html,x", "not a url", "", "  "]) {
      expect(signupForm(url), url).toBeNull();
    }
    expect(signupStatus("http://example.com").kind).toBe("invalid");
    expect(signupStatus("").kind).toBe("empty");
    expect(sectionSchema.safeParse({ signupUrl: "http://example.com/f" }).success).toBe(false);
    expect(sectionSchema.safeParse({ signupUrl: "https://example.com/f" }).success).toBe(true);
  });
});

describe("an exported section collects the email itself", () => {
  const BUTTONDOWN = "https://buttondown.com/api/emails/embed-subscribe/acme";

  it("renders a labelled, working form in place of the button", async () => {
    const html = await exportHtml([
      { heading: "Be first in line", ctaLabel: "Old button", ctaHref: "#", signupUrl: BUTTONDOWN, signupButton: "Join the waitlist", scrollHeight: 1000 },
    ]);
    expect(html).toContain(`<form class="sc-signup" method="post" action="${BUTTONDOWN}" target="_blank" rel="noopener"`);
    expect(html).toMatch(/<label for="sc-email-0" class="sc-visually-hidden">Email address<\/label>/);
    expect(html).toMatch(/<input id="sc-email-0" type="email" name="email" required autocomplete="email"/);
    expect(html).toContain('<input type="hidden" name="embed" value="1" />');
    expect(html).toMatch(/<button type="submit"[^>]*>Join the waitlist<\/button>/);
    expect(html).not.toContain("Old button");
    expect(html).toContain(".sc-visually-hidden {");
  });

  it("keeps the button where no signup is set", async () => {
    const html = await exportHtml([{ heading: "A", ctaLabel: "Read more", ctaHref: "#x", scrollHeight: 1000 }]);
    expect(html).toContain(">Read more</a>");
    expect(html).not.toContain('class="sc-signup"');
  });

  it("cannot be used to inject markup through the URL or the label", async () => {
    const html = await exportHtml([
      { heading: "A", signupUrl: 'https://example.com/"><script>alert(1)</script>', signupButton: '<img src=x onerror=alert(1)>', scrollHeight: 1000 },
    ]);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x onerror");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("draws the same form in the editor's preview", () => {
    const preview = readFileSync("src/components/SiteRenderer.tsx", "utf8");
    expect(preview).toContain("const signup = signupForm(s.signupUrl);");
    expect(preview).toContain("name={signup.emailName}");
    expect(preview).toContain('type="email"');
  });
});

const BUILD_SITE = path.resolve(__dirname, "../../plugins/scrollcraft/skills/scrollcraft/scripts/build-site.mjs");
const ONE_PX_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof" +
    "Hh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDU0NP/bAEMBCQkJDAsMGA0NGDIhHCEy" +
    "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAB" +
    "AAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAA" +
    "AAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMB" +
    "AAIRAxEAPwCdABmX/9k=",
  "base64"
);

function pluginHtml(sections: unknown[]): string {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "scrollcraft-signup-"));
  try {
    mkdirSync(path.join(tmp, "frames"));
    writeFileSync(path.join(tmp, "frames", "frame_0000.jpg"), ONE_PX_JPEG);
    writeFileSync(path.join(tmp, "scrollcraft.json"), JSON.stringify({ sections }));
    const run = spawnSync(process.execPath, [BUILD_SITE, "--spec", path.join(tmp, "scrollcraft.json"), "--out", path.join(tmp, "dist")], { encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0);
    return readFileSync(path.join(tmp, "dist", "index.html"), "utf8");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function formOf(html: string) {
  return {
    action: /<form class="sc-signup"[^>]*action="([^"]*)"/.exec(html)?.[1] ?? null,
    emailName: /type="email" name="([^"]*)"/.exec(html)?.[1] ?? null,
    hidden: [...html.matchAll(/<input type="hidden" name="([^"]*)" value="([^"]*)"/g)].map((m) => [m[1], m[2]]),
    button: /<button type="submit"[^>]*>([^<]*)<\/button>/.exec(html)?.[1] ?? null,
  };
}

describe("the plugin builds the same form the web app exports", () => {
  it.each([
    "https://acme.us8.list-manage.com/subscribe/post?u=abc123&id=def456",
    "https://app.kit.com/forms/1234567/subscriptions",
    "https://buttondown.com/api/emails/embed-subscribe/acme",
    "https://formspree.io/f/xyzabcd",
    "https://forms.example.com/subscribe",
    "https://embeds.beehiiv.com/abc",
    "http://acme.us8.list-manage.com/subscribe/post",
  ])("%s", async (url) => {
    const sections = [{ heading: "Waitlist", signupUrl: url, signupButton: "Count me in", scrollHeight: 1000 }];
    const web = formOf(await exportHtml(sections));
    const plugin = formOf(pluginHtml(sections));
    expect(plugin).toEqual(web);
    // A URL a plain form cannot use renders no form at all in either.
    const usable = signupForm(url) !== null;
    expect(web.action !== null, "form presence").toBe(usable);
  });
});
