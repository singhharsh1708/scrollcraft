import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { exportReadme } from "@/lib/exportAssets";

const rateLimitMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));

type Handler = typeof import("../app/api/export-site/route").POST;
let POST: Handler;

beforeEach(async () => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ allowed: true });
  ({ POST } = await import("../app/api/export-site/route"));
});

async function loaderSource(): Promise<string> {
  const res = await POST(
    new Request("https://scrollcraft.space/api/export-site", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sections: [{ heading: "Section 1", scrollHeight: 1000 }], siteName: "Clip", frameCount: 12, fps: 24 }),
    }) as unknown as NextRequest
  );
  expect(res.status).toBe(200);
  const { html } = await res.json();
  const start = html.indexOf("function showMissingFrames()");
  const end = html.indexOf("// Load only the set actually being drawn");
  expect(start, "the missing-frames notice is gone").toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
}

/**
 * The exported loader, run against images that either all fail or all load.
 *
 * Measured in Chrome: the same export opened with its frames folder beside it painted
 * its background, and opened alone, as Windows does when index.html is double-clicked
 * inside the ZIP, stayed pure black with 12 frame requests failing and nothing on the
 * page to say why.
 */
async function run(source: string, frames: "missing" | "present") {
  const appended: { id: string; role: string | null; text: string }[] = [];
  const document = {
    getElementById: (id: string) => appended.find((n) => n.id === id) ?? null,
    createElement: () => {
      const attrs: Record<string, string> = {};
      const node = { id: "", style: { cssText: "" }, textContent: "", setAttribute: (k: string, v: string) => { attrs[k] = v; } };
      return new Proxy(node, { get: (t, k) => (k === "attrs" ? attrs : (t as Record<string | symbol, unknown>)[k]) });
    },
    body: {
      appendChild: (n: { id: string; textContent: string; attrs: Record<string, string> }) =>
        appended.push({ id: n.id, role: n.attrs.role ?? null, text: n.textContent }),
    },
  };
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decoding = "";
    decode() { return Promise.resolve(); }
    set src(_v: string) { queueMicrotask(() => (frames === "missing" ? this.onerror?.() : this.onload?.())); }
  }
  const preloadSet = new Function("document", "Image", "drawFrame", "currentFrame", `${source}; return preloadSet;`)(
    document, FakeImage, () => {}, 0
  );
  preloadSet(12, "frames", new Array(12), true);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  return appended;
}

describe("an export opened without its frames says why", () => {
  it("shows a notice when every frame fails to load", async () => {
    const shown = await run(await loaderSource(), "missing");
    expect(shown).toHaveLength(1);
    expect(shown[0].role).toBe("alert");
    expect(shown[0].text).toMatch(/extract the whole ZIP first/);
  });

  it("stays out of the way when the frames are there", async () => {
    expect(await run(await loaderSource(), "present")).toHaveLength(0);
  });
});

describe("the README tells the owner how to open the export", () => {
  it("says to extract the ZIP, and no longer claims opening the extracted page fails", () => {
    const readme = exportReadme("Site", false, "https://scrollcraft.space");
    expect(readme).toMatch(/Extract the whole ZIP before opening anything/);
    expect(readme).not.toMatch(/Do \*\*not\*\* open `index\.html` by double-clicking it/);
  });
});
