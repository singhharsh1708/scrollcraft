import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import {
  ALLOWED_IMAGE_TYPES,
  BRIEF_RULES,
  MAX_DESCRIPTION,
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  briefSchema,
  briefToSite,
  checkBriefInput,
  type Brief,
} from "@/lib/siteBrief";
import { sectionsSchema, themeSchema, siteStyleSchema } from "@/lib/siteSchema";

/**
 * This is the one route in the app that spends money per call, and the one that hands a
 * stranger's prose to a model and then puts the answer into the editor. So the tests are
 * about three things rather than coverage: that the cheap checks happen before any call
 * is made, that what comes back is something the editor would actually accept, and that
 * no failure path leaks the credential the route runs on.
 */

const rateLimitMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));

/**
 * The SDK is replaced wholesale. The error classes have to be real classes because the
 * route branches on `instanceof`, and they have to be the same classes the route sees,
 * which is why they are built in the hoisted block and handed to both sides.
 */
const sdk = vi.hoisted(() => {
  class APIError extends Error {
    status: number;
    constructor(status = 500, message = "upstream said no") {
      super(message);
      this.status = status;
    }
  }
  class RateLimitError extends Error {}
  class AuthenticationError extends Error {}
  class PermissionDeniedError extends Error {}
  return { parse: vi.fn(), APIError, RateLimitError, AuthenticationError, PermissionDeniedError };
});

vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    messages = { parse: sdk.parse };
    static APIError = sdk.APIError;
    static RateLimitError = sdk.RateLimitError;
    static AuthenticationError = sdk.AuthenticationError;
    static PermissionDeniedError = sdk.PermissionDeniedError;
  }
  return { default: Anthropic };
});

type Handler = typeof import("../app/api/generate-site/route").POST;
let POST: Handler;

/** Long enough to clear the 20 character floor, specific enough to be a real brief. */
const DESCRIPTION = "Nadeem Cycle Works on Hazratganj road, repairs and second hand cycles since 1998.";

/** A distinctive key, so a test can grep the whole response for it. */
const API_KEY = "sk-ant-leak-canary-0000";

const BRIEF: Brief = {
  siteName: "Nadeem Cycle Works",
  tagline: "Cycle repairs on Hazratganj road since 1998",
  style: "geometric",
  colors: ["#1b4332", "#95d5b2", "#0a0a0a"],
  fontDisplay: "Archivo",
  fontBody: "Inter",
  ink: "#f2f2f2",
  accent: "#1b4332",
  accentText: "#95d5b2",
  sections: [
    { kind: "statement", layout: "center", reveal: "mask", eyebrow: "Since 1998", heading: "Your cycle back by evening", body: "", ctaLabel: "Find the shop" },
    { kind: "text", layout: "left", reveal: "fade", eyebrow: "The work", heading: "Punctures, gears, wheel truing", body: "Two mechanics, both here since the shop opened.", ctaLabel: "" },
    { kind: "text", layout: "right", reveal: "stagger", eyebrow: "Second hand", heading: "Used cycles, checked before sale", body: "Every one stripped and rebuilt first.", ctaLabel: "" },
    { kind: "text", layout: "left", reveal: "fade", eyebrow: "Not for us", heading: "We do not touch electric cycles", body: "The batteries need a dealer, not us.", ctaLabel: "" },
    { kind: "text", layout: "right", reveal: "fade", eyebrow: "Come by", heading: "Open seven days from eight", body: "Walk in, no appointment.", ctaLabel: "Get directions" },
  ],
};

function okResponse(overrides: Record<string, unknown> = {}) {
  return {
    stop_reason: "end_turn",
    parsed_output: BRIEF,
    usage: { input_tokens: 1200, cache_read_input_tokens: 900, output_tokens: 700 },
    ...overrides,
  };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("https://scrollcraft.space/api/generate-site", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }) as unknown as NextRequest
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  rateLimitMock.mockResolvedValue({ allowed: true });
  sdk.parse.mockResolvedValue(okResponse());
  vi.stubEnv("ANTHROPIC_API_KEY", API_KEY);
  ({ POST } = await import("../app/api/generate-site/route"));
});

/** A base64 payload the checker will accept: the alphabet is all it looks at. */
const PIXEL = "AAAA";
const image = (over: Record<string, unknown> = {}) => ({ media_type: "image/png", data: PIXEL, ...over });

describe("the cheap checks happen before anything is spent", () => {
  it("asks for more than a few words, because a thin description produces a thin site", () => {
    const result = checkBriefInput({ description: "A cycle shop" });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/at least a sentence/i);
  });

  it("counts the description after trimming, so whitespace cannot pad it to length", () => {
    expect(checkBriefInput({ description: `   ${"x".repeat(10)}          ` }).ok).toBe(false);
  });

  it("refuses a description past the cap, since the whole prompt has to stay bounded", () => {
    const result = checkBriefInput({ description: "x".repeat(MAX_DESCRIPTION + 1) });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain(String(MAX_DESCRIPTION));
  });

  it("refuses a fourth photograph, which is where the input cost runs away", () => {
    const images = Array.from({ length: MAX_IMAGES + 1 }, () => image());
    const result = checkBriefInput({ description: DESCRIPTION, images });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/Up to 3 photographs/);
  });

  it("refuses a media type the model cannot read", () => {
    for (const type of ["image/svg+xml", "image/heic", "application/pdf", "text/html", ""]) {
      const result = checkBriefInput({ description: DESCRIPTION, images: [image({ media_type: type })] });
      expect(result.ok, type).toBe(false);
      expect(result.ok === false && result.error).toMatch(/JPEG, PNG, WebP or GIF/);
    }
    for (const type of ALLOWED_IMAGE_TYPES) {
      expect(checkBriefInput({ description: DESCRIPTION, images: [image({ media_type: type })] }).ok, type).toBe(true);
    }
  });

  it("refuses a photograph over the per image byte cap, measured on the decoded size", () => {
    // base64 carries three bytes per four characters, so this is the first length over.
    const tooBig = "A".repeat(Math.ceil(MAX_IMAGE_BYTES / 0.75) + 1);
    const result = checkBriefInput({ description: DESCRIPTION, images: [image({ data: tooBig })] });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/under 2 MB/);

    const justUnder = "A".repeat(Math.floor(MAX_IMAGE_BYTES / 0.75));
    expect(checkBriefInput({ description: DESCRIPTION, images: [image({ data: justUnder })] }).ok).toBe(true);
  });

  it("refuses anything that is not base64, rather than forwarding it as if it were", () => {
    for (const data of ["data:image/png;base64,AAAA", "AAA A", "<svg/>", "AAAA!", ""]) {
      const result = checkBriefInput({ description: DESCRIPTION, images: [image({ data })] });
      expect(result.ok, data).toBe(false);
      expect(result.ok === false && result.error).toMatch(/could not be read/);
    }
  });

  it("accepts a real description with three photographs, and returns them normalised", () => {
    const result = checkBriefInput({
      description: `  ${DESCRIPTION}  `,
      images: [image(), image({ media_type: "image/jpeg" }), image({ media_type: "image/webp" })],
    });
    expect(result).toEqual({
      ok: true,
      description: DESCRIPTION,
      images: [
        { media_type: "image/png", data: PIXEL },
        { media_type: "image/jpeg", data: PIXEL },
        { media_type: "image/webp", data: PIXEL },
      ],
    });
  });

  it("treats a missing or malformed images field as no photographs at all", () => {
    for (const images of [undefined, null, "three", 3, {}]) {
      const result = checkBriefInput({ description: DESCRIPTION, images });
      expect(result.ok, String(images)).toBe(true);
      expect(result.ok === true && result.images).toEqual([]);
    }
  });
});

/**
 * The model answers in its own shape, which is not the editor's shape. briefToSite is the
 * only place those two meet, so if it drifts the symptom is a site that generates fine and
 * then will not open, which is the worst possible place to find out.
 */
describe("a brief becomes something the editor will actually open", () => {
  const site = briefToSite(BRIEF);

  it("produces sections, a theme and a style that pass the editor's own schemas", () => {
    const sections = sectionsSchema.safeParse(site.sections);
    const theme = themeSchema.safeParse(site.theme);
    const style = siteStyleSchema.safeParse(site.style);
    expect(sections.error?.issues[0]).toBeUndefined();
    expect(theme.error?.issues[0]).toBeUndefined();
    expect(style.error?.issues[0]).toBeUndefined();
    expect([sections.success, theme.success, style.success]).toEqual([true, true, true]);
  });

  it("gives every section an id, because the editor keys its list on them", () => {
    const ids = site.sections.map((s) => s.id);
    expect(ids).toHaveLength(BRIEF.sections.length);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only sets a button target where there is a button, so no section links nowhere", () => {
    for (const [i, section] of site.sections.entries()) {
      const label = BRIEF.sections[i].ctaLabel;
      expect(section.ctaLabel, `section ${i}`).toBe(label || undefined);
      expect(section.ctaHref, `section ${i}`).toBe(label ? "#contact" : undefined);
    }
    // The fixture has to exercise both sides for the above to mean anything.
    expect(site.sections.some((s) => s.ctaHref)).toBe(true);
    expect(site.sections.some((s) => !s.ctaHref)).toBe(true);
  });

  it("drops an empty body rather than carrying an empty string into the editor", () => {
    expect(site.sections[0].body).toBeUndefined();
    expect(site.sections[1].body).toBe(BRIEF.sections[1].body);
  });

  it("carries the tagline over as the site description, which is what the page title uses", () => {
    expect(site.siteName).toBe(BRIEF.siteName);
    expect(site.siteDescription).toBe(BRIEF.tagline);
  });

  it("holds the fixture itself to the schema the model answers in", () => {
    expect(briefSchema.safeParse(BRIEF).success).toBe(true);
  });
});

describe("the route refuses before it calls out", () => {
  it("answers 503 with no key configured, rather than failing inside the SDK", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await post({ description: DESCRIPTION });
    expect(res.status).toBe(503);
    expect(sdk.parse).not.toHaveBeenCalled();
    expect(rateLimitMock).not.toHaveBeenCalled();
  });

  it("answers 429 once the address is over its allowance", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false });
    const res = await post({ description: DESCRIPTION });
    expect(res.status).toBe(429);
    expect(sdk.parse).not.toHaveBeenCalled();
  });

  it("answers 400 to a description too short to generate from, without spending a call", async () => {
    const res = await post({ description: "cycles" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at least a sentence/i);
    expect(sdk.parse).not.toHaveBeenCalled();
  });

  it("answers 400 to a body that is not JSON", async () => {
    const res = await post("not json at all");
    expect(res.status).toBe(400);
    expect(sdk.parse).not.toHaveBeenCalled();
  });
});

describe("the route hands back a site when the model answers", () => {
  it("answers 200 with the sections, theme and style the editor expects", async () => {
    const res = await post({ description: DESCRIPTION });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.siteName).toBe(BRIEF.siteName);
    expect(body.siteDescription).toBe(BRIEF.tagline);
    expect(body.sections).toHaveLength(BRIEF.sections.length);
    expect(siteStyleSchema.safeParse(body.style).success).toBe(true);
    expect(themeSchema.safeParse(body.theme).success).toBe(true);
    expect(sectionsSchema.safeParse(body.sections).success).toBe(true);
  });

  it("answers 422 when the model declines, which is the user's input to fix, not ours", async () => {
    sdk.parse.mockResolvedValue(okResponse({ stop_reason: "refusal", parsed_output: null, stop_details: { category: "other" } }));
    const res = await post({ description: DESCRIPTION });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/describing the business plainly/);
  });

  it("answers 502 when the answer ran out of room", async () => {
    sdk.parse.mockResolvedValue(okResponse({ stop_reason: "max_tokens" }));
    expect((await post({ description: DESCRIPTION })).status).toBe(502);
  });

  it("answers 502 when there is nothing parsed to turn into a site", async () => {
    sdk.parse.mockResolvedValue(okResponse({ parsed_output: null }));
    expect((await post({ description: DESCRIPTION })).status).toBe(502);
  });

  it("answers 502 rather than 200 when the result would not pass the editor's schema", async () => {
    // A typeface name the editor's font schema rejects: it goes into a stylesheet URL.
    sdk.parse.mockResolvedValue(okResponse({ parsed_output: { ...BRIEF, fontDisplay: "Not/A Font" } }));
    expect((await post({ description: DESCRIPTION })).status).toBe(502);
  });
});

describe("the request put to the model is the one that was designed", () => {
  async function sentRequest(body: unknown) {
    await post(body);
    expect(sdk.parse).toHaveBeenCalledTimes(1);
    return sdk.parse.mock.calls[0][0] as {
      model: string;
      max_tokens: number;
      system: { type: string; text: string; cache_control?: { type: string } }[];
      messages: { role: string; content: { type: string }[] }[];
    };
  }

  it("names the model the prices and the rules were written against", async () => {
    const sent = await sentRequest({ description: DESCRIPTION });
    expect(sent.model).toBe("claude-opus-5-5");
    expect(sent.max_tokens).toBeGreaterThan(0);
  });

  it("marks the rules cacheable, which is where nine tenths of the input cost goes", async () => {
    const sent = await sentRequest({ description: DESCRIPTION });
    expect(sent.system).toHaveLength(1);
    expect(sent.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(sent.system[0].text).toBe(BRIEF_RULES);
  });

  it("puts the photographs before the text, which is where the model reads them best", async () => {
    const sent = await sentRequest({
      description: DESCRIPTION,
      images: [image(), image({ media_type: "image/jpeg" })],
    });
    expect(sent.messages[0].role).toBe("user");
    expect(sent.messages[0].content.map((block) => block.type)).toEqual(["image", "image", "text"]);
    expect(sent.messages[0].content.at(-1)).toMatchObject({ text: expect.stringContaining(DESCRIPTION) });
  });

  it("sends only the description and the photographs, never anything else from the body", async () => {
    const sent = await sentRequest({ description: DESCRIPTION, images: [], email: "someone@example.com" });
    expect(JSON.stringify(sent)).not.toContain("someone@example.com");
  });
});

/**
 * The key is in the environment of a route that talks to an upstream service and then
 * reports what the upstream said. That is exactly the shape of accident that puts a
 * credential in a JSON error body, so every path is checked, not just the happy one.
 */
describe("nothing the route returns contains the key it runs on", () => {
  const paths: [string, () => void][] = [
    ["a good answer", () => sdk.parse.mockResolvedValue(okResponse())],
    ["a refusal", () => sdk.parse.mockResolvedValue(okResponse({ stop_reason: "refusal", parsed_output: null }))],
    ["an upstream rate limit", () => sdk.parse.mockRejectedValue(new sdk.RateLimitError("slow down"))],
    ["rejected credentials", () => sdk.parse.mockRejectedValue(new sdk.AuthenticationError(`bad key ${API_KEY}`))],
    ["a denied permission", () => sdk.parse.mockRejectedValue(new sdk.PermissionDeniedError(`no access for ${API_KEY}`))],
    ["an upstream error", () => sdk.parse.mockRejectedValue(new sdk.APIError(500, `x-api-key ${API_KEY} failed`))],
    ["something unexpected", () => sdk.parse.mockRejectedValue(new Error(`socket closed carrying ${API_KEY}`))],
  ];

  it.each(paths)("keeps it out of the body and the headers on %s", async (_name, arrange) => {
    arrange();
    const res = await post({ description: DESCRIPTION });
    const text = await res.text();
    expect(text).not.toContain(API_KEY);
    expect(JSON.stringify([...res.headers])).not.toContain(API_KEY);
  });

  it("maps each upstream failure to a status that says whose problem it is", async () => {
    const cases: [Error, number][] = [
      [new sdk.RateLimitError("slow down"), 429],
      [new sdk.AuthenticationError("bad key"), 503],
      [new sdk.PermissionDeniedError("no access"), 503],
      [new sdk.APIError(500, "upstream"), 502],
      [new Error("socket closed"), 500],
    ];
    for (const [err, status] of cases) {
      sdk.parse.mockRejectedValue(err);
      expect((await post({ description: DESCRIPTION })).status, err.constructor.name).toBe(status);
    }
  });
});

/**
 * The rules are the product. A site that reads like every other generated site is worth
 * less than no site, so the two instructions that do the most work against that are
 * asserted here: the banned-phrase list, and the ban on inventing credibility.
 */
describe("the house rules still say the things the output depends on", () => {
  it("bans the phrases that make generated copy recognisable", () => {
    for (const phrase of ["elevate", "seamless", "cutting edge"]) {
      expect(BRIEF_RULES, phrase).toContain(`"${phrase}"`);
    }
    expect(BRIEF_RULES).toMatch(/Never write:/);
  });

  it("forbids inventing the details a reader would check", () => {
    expect(BRIEF_RULES).toMatch(/Do not invent[^.]*awards/);
    expect(BRIEF_RULES).toMatch(/Do not invent[^.]*testimonials/);
    expect(BRIEF_RULES).toMatch(/If the description gives you no numbers, write without numbers\./);
  });

  it("carries nothing that would change between calls, or the cache never hits", () => {
    expect(BRIEF_RULES).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(BRIEF_RULES.trim()).toBe(BRIEF_RULES);
  });
});
