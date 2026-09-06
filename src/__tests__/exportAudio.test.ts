import { describe, it, expect } from "vitest";
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
