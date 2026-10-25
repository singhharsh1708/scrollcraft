import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { checkBriefInput, MAX_DOCUMENT_CHARS, MAX_DOCUMENT_PDF_BYTES, BRIEF_RULES } from "@/lib/siteBrief";

const rateLimitMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/credits", async (orig) => ({
  ...(await orig<typeof import("@/lib/credits")>()),
  takeAllowance: async () => ({ ok: true, kind: "free", release: async () => {} }),
  balanceOf: async () => null,
}));
vi.mock("@/auth", () => ({ accountIdentity: async () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

const parse = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    messages = { parse };
    static APIError = class extends Error {};
    static RateLimitError = class extends Error {};
    static AuthenticationError = class extends Error {};
    static PermissionDeniedError = class extends Error {};
  }
  return { default: Anthropic };
});

const DESCRIPTION = "Nadeem Cycle Works on Hazratganj road, repairs and second hand cycles since 1998.";
const PDF = "JVBERi0xLjQK";
const pdf = (data = PDF) => ({ name: "menu.pdf", media_type: "application/pdf", data });
const text = (data = "Chai 20, samosa 15") => ({ name: "menu.txt", media_type: "text/plain", data });

describe("checkBriefInput takes one owner's document", () => {
  it("accepts a PDF within the cap", () => {
    const r = checkBriefInput({ description: DESCRIPTION, documents: [pdf()] });
    expect(r.ok && r.document).toEqual({ name: "menu.pdf", media_type: "application/pdf", data: PDF });
  });

  it("accepts a text document within the cap", () => {
    const r = checkBriefInput({ description: DESCRIPTION, documents: [text("x".repeat(MAX_DOCUMENT_CHARS))] });
    expect(r.ok && r.document?.media_type).toBe("text/plain");
  });

  it("treats no documents as none", () => {
    const r = checkBriefInput({ description: DESCRIPTION });
    expect(r.ok && r.document).toBeNull();
  });

  it.each([
    ["two documents", [pdf(), text()]],
    ["a Word file", [{ name: "cv.docx", media_type: "application/msword", data: "AAAA" }]],
    ["an oversize PDF", [pdf("JVBER" + "A".repeat(Math.ceil(MAX_DOCUMENT_PDF_BYTES / 0.75)))]],
    ["a PDF that is not one", [pdf("AAAA")]],
    ["an oversize text file", [text("x".repeat(MAX_DOCUMENT_CHARS + 1))]],
    ["an empty text file", [text("   ")]],
  ])("rejects %s", (_, documents) => {
    expect(checkBriefInput({ description: DESCRIPTION, documents }).ok).toBe(false);
  });

  it("tells the model to use the document and not invent beyond it", () => {
    expect(BRIEF_RULES).toMatch(/resume, a menu or a brochure/);
    expect(BRIEF_RULES).toMatch(/Never invent beyond it/);
  });
});

describe("the route forwards the document", () => {
  let POST: typeof import("../app/api/generate-site/route").POST;
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    rateLimitMock.mockResolvedValue({ allowed: true });
    parse.mockRejectedValue(new Error("stop here"));
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    ({ POST } = await import("../app/api/generate-site/route"));
  });

  const send = (body: unknown) =>
    POST(new Request("https://scrollcraft.space/api/generate-site", { method: "POST", body: JSON.stringify(body) }) as unknown as NextRequest);
  const content = () => parse.mock.calls[0][0].messages[0].content as Record<string, unknown>[];

  it("sends a PDF as a base64 document block before the description", async () => {
    await send({ description: DESCRIPTION, documents: [pdf()] });
    const blocks = content();
    expect(blocks.map((b) => b.type)).toEqual(["document", "text"]);
    expect(blocks[0]).toMatchObject({ source: { type: "base64", media_type: "application/pdf", data: PDF } });
  });

  it("sends a text document as a labelled text block", async () => {
    await send({ description: DESCRIPTION, documents: [text()] });
    expect(content()[0]).toMatchObject({ type: "text", text: expect.stringMatching(/^The owner's document \(menu\.txt\)[\s\S]*Chai 20/) });
  });

  it("never forwards a contact field", async () => {
    await send({ description: DESCRIPTION, documents: [text()], contact: "+91 98765 43210", contactHref: "tel:+919876543210" });
    expect(JSON.stringify(parse.mock.calls[0][0])).not.toMatch(/98765|tel:/);
  });
});

describe("the home composer", () => {
  it("has labelled Photos, Video and Document buttons and one h1", async () => {
    const { default: PromptHero } = await import("@/components/PromptHero");
    const html = renderToStaticMarkup(createElement(PromptHero, { reducedMotion: true }));
    for (const label of ["Photos", "Video", "Document"]) {
      expect(html).toMatch(new RegExp(`<button[^>]*>(?:<svg[\\s\\S]*?</svg>)?${label}</button>`));
    }
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Describe your business"');
  });
});
