import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const SKILL = "plugins/scrollcraft/skills/scrollcraft";
const read = (file: string) => readFileSync(file, "utf8").replace(/\s+/g, " ");

describe("the plugin is described the way its scripts behave", () => {
  it("names the browser and Node version wherever it says what to install", () => {
    expect(read(`${SKILL}/scripts/verify.mjs`)).toContain("no Chrome, Chromium or Edge found");
    for (const file of ["README.md", "plugins/scrollcraft/README.md", "src/components/PluginInstall.tsx"]) {
      const text = read(file);
      expect(text, `${file} calls ffmpeg the only requirement`).not.toMatch(/only (?:external requirement|thing it needs)/i);
      expect(text, `${file} leaves out the browser verify needs`).toContain("Chrome, Chromium or Edge");
      expect(text, `${file} leaves out the Node version`).toMatch(/Node(?:\.js)? 22/);
    }
  });

  it("puts the audio file where each exporter writes it", () => {
    const contract = read(`${SKILL}/references/export-contract.md`);
    expect(read(`${SKILL}/scripts/build-site.mjs`)).toContain('audioOut = "audio." + ext');
    expect(contract).toMatch(/└── audio\.\w+ /);
    expect(read("src/app/api/export-site/route.ts")).toContain("new Audio('audio/track.${audioExt}')");
    expect(contract).toContain("audio/track.<ext>");
  });

  it("does not tell Claude the hosted ZIP always carries frames", () => {
    // A drawn background ships as a recipe; only an uploaded video ships frames/.
    expect(read("src/app/editor/page.tsx")).toContain("if (!exportProcedurally) {");
    for (const file of [`${SKILL}/SKILL.md`, `${SKILL}/references/export-contract.md`]) {
      const text = read(file);
      expect(text, `${file} says both halves emit the same layout`).not.toMatch(/same (?:bundle )?layout/i);
      expect(text, `${file} does not say when frames/ ships`).toContain("only when the background is an uploaded video");
    }
  });
});
