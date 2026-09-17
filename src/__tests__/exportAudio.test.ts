import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { exportReadme } from "@/lib/exportAssets";

/**
 * Background audio, and what the ZIP tells its owner about it.
 *
 * Exercised end to end in Chrome: uploading an MP3 and a WAV in the editor, exporting,
 * unzipping and serving. Both ship byte-identical (60,857 and 264,678 bytes) under the
 * extension the mime type maps to, the page loads exactly that path, the mute button
 * toggles, and the served page reports zero console errors. The feature was sound; the
 * README never mentioned it, so an owner met an undocumented folder and a track that
 * appears not to work.
 */
const ROUTE = readFileSync("src/app/api/export-site/route.ts", "utf8");
const EDITOR = readFileSync("src/app/editor/page.tsx", "utf8");

describe("the ZIP and the page agree on the audio filename", () => {
  it("derives the extension once, on the server, and hands it to the client", () => {
    // Two independent guesses at the extension would ship a file the page never loads.
    expect(ROUTE).toContain("const audioExt = AUDIO_EXT[baseMime] ?? \"mp3\";");
    expect(ROUTE).toContain("new Audio('audio/track.${audioExt}')");
    expect(ROUTE).toContain("audioExt,");
    expect(EDITOR).toContain("const { html, audioExt } = await res.json();");
    expect(EDITOR).toContain("zip.file(`audio/track.${audioExt}`, audioBase64, { base64: true });");
  });

  it("maps the formats a browser will actually decode", () => {
    for (const mime of ["audio/mpeg", "audio/wav", "audio/mp4", "audio/ogg", "audio/webm"]) {
      expect(ROUTE, `${mime} has no extension`).toContain(`"${mime}"`);
    }
  });
});

describe("the README explains the audio it shipped", () => {
  const withAudio = exportReadme("Site", true, "https://example.test", { hasAudio: true });
  const withoutAudio = exportReadme("Site", true, "https://example.test");

  it("lists the folder in the file table", () => {
    expect(withAudio).toContain("| `audio/` |");
  });

  it("says why the track does not start on load", () => {
    // The likeliest support question, and the answer is a browser policy nobody can
    // change: an owner otherwise deploys, hears nothing, and assumes it is broken.
    expect(withAudio).toContain("## About the audio");
    expect(withAudio).toMatch(/will not start on its own, and that is not a bug/);
    expect(withAudio).toMatch(/first click, tap or\s+key press/);
  });

  it("says how to replace or remove it", () => {
    expect(withAudio).toContain("replace the file in `audio/`");
    expect(withAudio).toContain('<button id="audio-mute">');
  });

  it("says none of it when there is no audio", () => {
    expect(withoutAudio).not.toContain("## About the audio");
    expect(withoutAudio).not.toContain("| `audio/` |");
    // and the rest of the README is unaffected
    expect(withoutAudio).toContain("## Put it online");
  });
});

const rateLimitMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rateLimit", () => ({ rateLimit: rateLimitMock, getClientIp: () => "1.2.3.4" }));

type Handler = typeof import("../app/api/export-site/route").POST;
let POST: Handler;

beforeEach(async () => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ allowed: true });
  ({ POST } = await import("../app/api/export-site/route"));
});

async function audioRuntime(): Promise<string> {
  const res = await POST(
    new Request("https://scrollcraft.app/api/export-site", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sections: [{ heading: "A", scrollHeight: 1000 }],
        siteName: "Audio", frameCount: 10, fps: 24, hasAudio: true, audioMime: "audio/mpeg",
      }),
    }) as unknown as NextRequest
  );
  expect(res.status).toBe(200);
  const { html } = await res.json();
  const script = /\(function\(\) \{\s*var audio = new Audio[\s\S]*?\n {4}\}\)\(\);/.exec(html);
  expect(script, "no audio runtime in the export").toBeTruthy();
  return script![0];
}

/**
 * The exported audio runtime against a fake page, with playback blocked until a gesture.
 * Measured in headless Chrome on the previous build: every play() attempted from a wheel
 * scroll rejected with NotAllowedError, so the track only ever started on a click.
 */
function run(script: string) {
  let clock = 0;
  let allowed = false;
  let nextId = 1;
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let rafs: ((t: number) => void)[] = [];
  const listeners = new Map<string, ((e?: unknown) => void)[]>();
  const el = {
    paused: true, volume: 1, muted: false, loop: false, attempts: 0,
    play() {
      el.attempts++;
      if (!allowed) return Promise.reject(Object.assign(new Error("blocked"), { name: "NotAllowedError" }));
      el.paused = false;
      return Promise.resolve();
    },
    pause() { el.paused = true; },
    addEventListener() {},
  };
  const win = {
    AudioContext: undefined, webkitAudioContext: undefined, scrollY: 0,
    addEventListener: (type: string, fn: (e?: unknown) => void) =>
      listeners.set(type, [...(listeners.get(type) ?? []), fn]),
  };
  new Function(
    "window", "document", "Audio", "performance", "setTimeout", "clearTimeout",
    "requestAnimationFrame", "cancelAnimationFrame", script
  )(
    win,
    { getElementById: () => null },
    function () { return el; },
    { now: () => clock },
    (fn: () => void, ms: number) => { const id = nextId++; timers.push({ at: clock + ms, fn, id }); return id; },
    (id: number) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
    (fn: (t: number) => void) => rafs.push(fn),
    () => { rafs = []; }
  );

  const advance = (ms: number) => {
    const end = clock + ms;
    while (clock < end) {
      clock = Math.min(clock + 16, end);
      for (const t of timers.filter((t) => t.at <= clock)) {
        timers.splice(timers.indexOf(t), 1);
        t.fn();
      }
      const queued = rafs;
      rafs = [];
      queued.forEach((fn) => fn(clock));
    }
  };
  const scroll = (px: number, overMs: number) => { win.scrollY += px; advance(overMs); (listeners.get("scroll") ?? []).forEach((fn) => fn()); };
  const gesture = async () => {
    allowed = true;
    (listeners.get("pointerdown") ?? []).forEach((fn) => fn());
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  };
  return { el, advance, scroll, gesture };
}

describe("the exported track survives the gesture that starts it", () => {
  it("keeps playing after the click that unblocks it", async () => {
    const page = run(await audioRuntime());

    page.scroll(400, 100);
    page.scroll(400, 100);
    expect(page.el.paused, "a wheel scroll cannot start playback").toBe(true);
    expect(page.el.attempts).toBeGreaterThan(0);

    // The visitor scrolls, reads for a moment, then clicks: the timer armed by that
    // scrolling is nearly up when playback finally becomes possible.
    page.advance(1900);
    await page.gesture();
    expect(page.el.paused).toBe(false);

    page.advance(1500);
    expect(page.el.paused, "the stale idle timer faded out the track it had never heard").toBe(false);
  });

  it("still fades out once the visitor stops scrolling", async () => {
    const page = run(await audioRuntime());
    await page.gesture();
    page.advance(3200);
    expect(page.el.paused).toBe(true);
  });

  it("stays audible while the visitor scrolls slowly", async () => {
    const page = run(await audioRuntime());
    await page.gesture();
    page.scroll(6, 200);
    expect(page.el.volume).toBeGreaterThanOrEqual(0.3);
  });
});
