import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { proceduralRuntimeSource } from "@/lib/generate2DFrames";

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


/**
 * The runtime the page inlines, taken from the generator rather than sliced back out of
 * the HTML. Slicing meant naming the functions, and a production build renames all of
 * them: pinning "function hexToRgb" and "drawFrame2D" is exactly what let a black-screen
 * export ship, because unminified those names are correct and in a real build neither
 * string is in the page at all.
 */
function runtime(): { source: string; entry: string } {
  return proceduralRuntimeSource();
}

/** The name the emitted page calls the runtime by. */
function calledEntry(html: string): string {
  const call = /([A-Za-z_$][\w$]*)\(ctx, cssW, cssH, p, recipe\)/.exec(html);
  expect(call, "no procedural draw call in the page").not.toBeNull();
  return call![1];
}

/** Every name the emitted block binds, so a call can be checked against them. */
function declaredNames(source: string): Set<string> {
  const out = new Set<string>();
  for (const m of source.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) out.add(m[1]);
  for (const m of source.matchAll(/\bvar\s+([A-Za-z_$][\w$]*)\s*=/g)) out.add(m[1]);
  return out;
}

/** A 2D context that records what was drawn on it. */
function recordingContext(calls: string[]) {
  return new Proxy({} as Record<string, unknown>, {
    get: (_t, prop: string) => {
      if (prop === "createLinearGradient" || prop === "createRadialGradient") {
        return () => ({ addColorStop: () => {} });
      }
      return (...args: unknown[]) => { calls.push(`${prop}(${args.length})`); };
    },
    set: () => true,
  });
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

    const { source, entry } = runtime();
    expect(html, "the page does not inline the runtime it is meant to").toContain(source);
    const calls: string[] = [];
    const stub = recordingContext(calls);
    const run = new Function(`${source}; return ${entry};`)() as (
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
    const { source, entry } = runtime();
    expect(html).toContain(source);
    const calls: string[] = [];
    const stub = recordingContext(calls);
    const run = new Function(`${source}; return ${entry};`)() as (
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

  it("calls a name the page declares, which a minified build renames", async () => {
    // The whole failure in one assertion. proceduralRuntimeSource emits fn.toString(),
    // so a production build ships the seven drawing functions as rJ, rK, rz and so on
    // while the caller wrote drawFrame2D by hand. Measured in Chrome against a
    // production build: "Uncaught ReferenceError: drawFrame2D is not defined" and a
    // black canvas on every procedural export.
    const html = await proceduralHtml();
    const { source, entry } = runtime();
    expect(calledEntry(html), "the call site does not match the runtime it is calling").toBe(entry);
    expect(declaredNames(source), `${entry} is not declared in the runtime`).toContain(entry);
  });

  it("survives having every declared name rewritten", async () => {
    // Unminified the emitted name and the source name agree, so nothing above can fail
    // on a build Vitest sees. Renaming every declaration reproduces what the minifier
    // does, and a hand-written call site cannot survive it.
    const { source, entry } = runtime();
    let mangledSource = source;
    let mangledEntry = entry;
    [...declaredNames(source)].forEach((name, i) => {
      mangledSource = mangledSource.replace(new RegExp(`\\b${name}\\b`, "g"), `m${i}`);
      if (mangledEntry === name) mangledEntry = `m${i}`;
    });
    expect(mangledEntry, "nothing was renamed, so this proves nothing").not.toBe(entry);

    const calls: string[] = [];
    const run = new Function(`${mangledSource}; return ${mangledEntry};`)() as (
      ctx: unknown, w: number, h: number, p: number, opts: unknown
    ) => void;
    run(recordingContext(calls), 1280, 720, 0.5, {
      style: "gradient", color1: "#111111", color2: "#222222", color3: "#333333", frameCount: 240,
    });
    expect(calls.length).toBeGreaterThan(0);
  });
});
