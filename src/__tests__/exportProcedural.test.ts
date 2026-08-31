import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";

const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));

type Handler = typeof import("../app/api/export-site/route").POST;
let POST: Handler;

const STYLE = JSON.stringify({ style: "gradient", colors: ["#111111", "#222222", "#333333"] });

function exportRequest(body: Record<string, unknown>): NextRequest {
  return new Request("https://scrollcraft.app/api/export-site", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

async function proceduralHtml(over: Record<string, unknown> = {}): Promise<string> {
  const res = await POST(exportRequest({
    sections: [{ heading: "A", scrollHeight: 1000 }],
    siteName: "Recipe Site",
    styleJson: STYLE,
    frameCount: 0,
    fps: 24,
    ...over,
  }));
  expect(res.status).toBe(200);
  return (await res.json()).html as string;
}

beforeEach(async () => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ allowed: true });
  ({ POST } = await import("../app/api/export-site/route"));
});

describe("procedural background export", () => {
  it("accepts an export with a recipe and no frames at all", async () => {
    const html = await proceduralHtml();
    expect(html).toContain("<canvas");
  });

  it("references no frame images, so the ZIP carries no JPEGs", async () => {
    const html = await proceduralHtml();
    expect(html).not.toContain("frame_0000.jpg");
    expect(html).not.toContain("'frames'");
    expect(html).not.toContain("frames-mobile");
  });

  it("inlines the real drawing core rather than a copy of it", async () => {
    const html = await proceduralHtml();
    for (const fn of ["drawFrame2D", "drawGradient", "drawGeometric", "drawParticles", "drawWave", "hexToRgb"]) {
      expect(html).toContain(fn);
    }
  });

  it("carries the recipe the site was built with", async () => {
    const html = await proceduralHtml();
    expect(html).toContain('"style":"gradient"');
    expect(html).toContain("#111111");
  });

  it("draws from the recipe instead of a baked image", async () => {
    const html = await proceduralHtml();
    expect(html).toContain("drawFrame2D(ctx, cssW, cssH, p, recipe)");
    expect(html).not.toContain("ctx.drawImage(img,");
  });

  it("still requires frames when there is no recipe to draw from", async () => {
    const res = await POST(exportRequest({
      sections: [{ heading: "A", scrollHeight: 1000 }],
      siteName: "Baked", frameCount: 0, fps: 24,
    }));
    expect(res.status).toBe(400);
  });

  it("still bakes frames when frames are supplied and no recipe is", async () => {
    const res = await POST(exportRequest({
      sections: [{ heading: "A", scrollHeight: 1000 }],
      siteName: "Baked", frameCount: 120, fps: 24,
    }));
    expect(res.status).toBe(200);
    const html = (await res.json()).html as string;
    expect(html).toContain("frame_");
    expect(html).not.toContain("drawFrame2D");
  });

  it("ignores an unparseable recipe and falls back to requiring frames", async () => {
    const res = await POST(exportRequest({
      sections: [{ heading: "A", scrollHeight: 1000 }],
      siteName: "Bad", styleJson: "{not json", frameCount: 0, fps: 24,
    }));
    expect(res.status).toBe(400);
  });
});

describe("the inlined runtime is executable", () => {
  it("draws using the recipe the page actually emits, not a hand-built one", async () => {
    // The original version of this test built its own options object in the correct
    // FrameOptions shape and ran the runtime against that. It passed while the export
    // emitted { style, colors: [...] }, which drawFrame2D cannot read — so every
    // procedurally exported site rendered a black screen and threw on first paint.
    // Parse the recipe out of the page and use exactly what ships.
    const html = await proceduralHtml();
    const recipeMatch = html.match(/var recipe = (\{[\s\S]*?\});/);
    expect(recipeMatch, "no recipe emitted").toBeTruthy();
    const recipe = JSON.parse(recipeMatch![1]);

    // The shape the drawing core requires.
    expect(recipe.color1).toBe("#111111");
    expect(recipe.color2).toBe("#222222");
    expect(recipe.color3).toBe("#333333");
    expect(recipe.style).toBe("gradient");
    expect(recipe.colors, "the colours array is not what drawFrame2D reads").toBeUndefined();

    const start = html.indexOf("function hexToRgb");
    const end = html.indexOf("var recipe =");
    const runtime = html.slice(start, end);

    const calls: string[] = [];
    const stub = new Proxy({} as Record<string, unknown>, {
      get: (_t, prop: string) => {
        if (prop === "createLinearGradient" || prop === "createRadialGradient") {
          return () => ({ addColorStop: () => {} });
        }
        return (...args: unknown[]) => { calls.push(`${prop}(${args.length})`); };
      },
      set: () => true,
    });

    const run = new Function(`${runtime}; return drawFrame2D;`)() as (
      ctx: unknown, w: number, h: number, p: number, opts: unknown
    ) => void;

    // Must not throw, and must actually paint.
    expect(() => run(stub, 1280, 720, 0.5, recipe)).not.toThrow();
    expect(calls.length).toBeGreaterThan(0);
  });

  it("draws to a canvas context without throwing", async () => {
    const html = await proceduralHtml();
    // Pull the serialised functions out of the page and run them against a recording
    // stub, so a broken inline (bad syntax, a missing helper) fails here rather than
    // silently shipping a blank background.
    const start = html.indexOf("function hexToRgb");
    const end = html.indexOf("var recipe =");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const runtime = html.slice(start, end);

    const calls: string[] = [];
    const stub = new Proxy({} as Record<string, unknown>, {
      get: (_t, prop: string) => {
        if (prop === "createLinearGradient" || prop === "createRadialGradient") {
          return () => ({ addColorStop: () => {} });
        }
        return (...args: unknown[]) => { calls.push(`${prop}(${args.length})`); };
      },
      set: () => true,
    });

    const run = new Function(`${runtime}; return drawFrame2D;`)() as (
      ctx: unknown, w: number, h: number, p: number, opts: unknown
    ) => void;

    for (const style of ["gradient", "geometric", "particles", "wave"]) {
      calls.length = 0;
      run(stub, 1280, 720, 0.5, {
        style, color1: "#111111", color2: "#222222", color3: "#333333", frameCount: 240,
      });
      expect(calls.length).toBeGreaterThan(0);
    }
  });
});
