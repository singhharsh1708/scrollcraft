import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { buildProjectFile, parseProjectFile } from "@/lib/projectFile";

const rateLimitMock = vi.hoisted(() => vi.fn());
const storeDocumentMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/frameStorage", () => ({ storeDocument: storeDocumentMock }));

const SPACER = '<div style="height:100vh;"></div>';

async function exportHtml(over: Record<string, unknown> = {}): Promise<string> {
  const { POST } = await import("../app/api/export-site/route");
  const req = new Request("https://scrollcraft.app/api/export-site", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sections: [{ heading: "Fresh bread daily", ctaLabel: "Call us", ctaHref: "tel:+441234567890", scrollHeight: 1200 }],
      siteName: "Bakery",
      frameCount: 10,
      ...over,
    }),
  }) as unknown as NextRequest;
  const res = await POST(req);
  expect(res.status).toBe(200);
  return (await res.json()).html as string;
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ allowed: true });
});

describe("an export that opens on the headline", () => {
  it("drops the leading spacer, so the first section is the first screen", async () => {
    const html = await exportHtml({ openOnHeadline: true });
    expect(html).not.toContain(SPACER);
    const container = html.slice(html.indexOf('<div id="scroll-container">'));
    expect(container.slice(0, 200)).toMatch(/<div id="scroll-container">\s*<section /);
  });

  it("sizes the scroll track to the sections alone", async () => {
    const html = await exportHtml({ openOnHeadline: true });
    expect(html).toContain("#scroll-container { position: relative; height: 1200px;");
    expect(html).toContain("const totalScrollHeight = 1200;");
  });

  it("keeps the scroll hint on the bottom edge, clear of the copy", async () => {
    const html = await exportHtml({ openOnHeadline: true });
    expect(html).toContain('<div id="scroll-hint" aria-hidden="true">');
    expect(html).toMatch(/#scroll-hint \{ bottom: 0\.5rem; \}\s*#scroll-hint \.arrow \{ display: none; \}/);
  });

  it("still maps the whole page onto the frames by measuring it", async () => {
    const html = await exportHtml({ openOnHeadline: true });
    expect(html).toContain("var maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);");
  });
});

describe("an export without the setting", () => {
  it("is unchanged: spacer, buffer and hint as before", async () => {
    for (const over of [{}, { openOnHeadline: false }, { openOnHeadline: "yes" }]) {
      const html = await exportHtml(over);
      expect(html).toContain(SPACER);
      expect(html).toContain("const totalScrollHeight = 2200;");
      expect(html).not.toContain("#scroll-hint { bottom: 0.5rem; }");
    }
  });

  it("leaves a named template on its old opening", async () => {
    const html = await exportHtml({ sections: undefined, template: "orbitcrm" });
    expect(html).toContain(SPACER);
  });
});

describe("the setting travels with the site", () => {
  it("survives a project file round trip", () => {
    const doc = { name: "Bakery", sections: [], openOnHeadline: true };
    const parsed = parseProjectFile(buildProjectFile(doc));
    expect(parsed.ok && parsed.value.document.openOnHeadline).toBe(true);
  });

  it("is left out of an older file, which reads as off", () => {
    const parsed = parseProjectFile(buildProjectFile({ name: "Old", sections: [] }));
    expect(parsed.ok && parsed.value.document.openOnHeadline).toBeUndefined();
  });

  it("is on for a site written from a description, and the editor is told it is fresh", async () => {
    const session = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      setItem: (k: string, v: string) => session.set(k, v),
      getItem: (k: string) => session.get(k) ?? null,
      removeItem: (k: string) => session.delete(k),
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      siteName: "Bakery", siteDescription: "Bread", sections: [{ heading: "Fresh bread" }], theme: {}, style: {},
    }), { status: 200 })));
    storeDocumentMock.mockResolvedValue(undefined);
    const { writeSite, FRESH_SITE_KEY } = await import("@/lib/writeSite");
    expect(await writeSite({ description: "A bakery" })).toEqual({ ok: true });
    expect(storeDocumentMock.mock.calls[0][0].openOnHeadline).toBe(true);
    expect(session.get(FRESH_SITE_KEY)).toBe("1");
  });

  it("does not mark a site fresh when the write fails", async () => {
    const session = new Map<string, string>();
    vi.stubGlobal("sessionStorage", { setItem: (k: string, v: string) => session.set(k, v) });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "No" }), { status: 500 })));
    const { writeSite } = await import("@/lib/writeSite");
    expect((await writeSite({ description: "A bakery" })).ok).toBe(false);
    expect(session.size).toBe(0);
    expect(storeDocumentMock).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the editor and the renderer honour it", () => {
  const editor = readFileSync("src/app/editor/page.tsx", "utf8");
  const renderer = readFileSync("src/components/SiteRenderer.tsx", "utf8");

  it("is on for a new document and off for a template", () => {
    expect(editor).toContain("useState(() => !pickedTemplate)");
  });

  it("reads a saved document as off unless it says otherwise", () => {
    expect(editor).toContain("setOpenOnHeadline(doc.openOnHeadline === true);");
  });

  it("saves, exports and downloads the setting", () => {
    const write = editor.slice(editor.indexOf("const writeDocument"), editor.indexOf("const handleSave"));
    expect(write).toContain("openOnHeadline,");
    const exportCall = editor.slice(editor.indexOf('fetch("/api/export-site"'), editor.indexOf("if (!res.ok)"));
    expect(exportCall).toContain("openOnHeadline,");
    const project = editor.slice(editor.indexOf("const currentProjectDocument"), editor.indexOf("const handleDownloadProject"));
    expect(project).toContain("openOnHeadline,");
  });

  it("drops the spacer and its buffer in the preview and the renderer", () => {
    expect(editor).toContain("{!openOnHeadline && <div style={{ height: previewViewportH || \"100vh\" }} />}");
    expect(editor).toContain("+ (openOnHeadline ? 0 : 1000)");
    expect(renderer).toContain('{!openOnHeadline && <div style={{ height: "100vh" }} />}');
    expect(renderer).toContain("+ (openOnHeadline ? 0 : INTRO_BUFFER)");
    expect(renderer).toContain("openOnHeadline = false,");
  });

  it("opens the public template preview on its headline", () => {
    expect(readFileSync("src/app/templates/[slug]/TemplatePreview.tsx", "utf8")).toMatch(/<SiteRenderer[\s\S]*?\n\s+openOnHeadline\n/);
  });

  it("welcomes a freshly written site and keeps the restore line", () => {
    expect(editor).toContain('"Your site is ready. Tap a section to change its words, then tap Export."');
    expect(editor).toContain("sessionStorage.removeItem(FRESH_SITE_KEY);");
  });
});
