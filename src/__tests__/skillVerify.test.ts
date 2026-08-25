import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPTS = path.resolve(__dirname, "../../plugins/scrollcraft/skills/scrollcraft/scripts");
const BUILD = path.join(SCRIPTS, "build-site.mjs");
const STYLE = path.join(SCRIPTS, "frames-from-style.mjs");
const VERIFY = path.join(SCRIPTS, "verify.mjs");

const CHROME = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean).find((p) => { try { return fs.statSync(p as string).isFile(); } catch { return false; } });

const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
const canRender = Boolean(CHROME) && hasFfmpeg;
const renderIt = canRender ? it : it.skip;

const ONE_PX_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof" +
    "Hh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDU0NP/bAEMBCQkJDAsMGA0NGDIhHCEy" +
    "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAB" +
    "AAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAA" +
    "AAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMB" +
    "AAIRAxEAPwCdABmX/9k=",
  "base64"
);

let tmp: string;
const node = (script: string, args: string[], timeout = 120000) =>
  spawnSync(process.execPath, [script, ...args], { encoding: "utf8", cwd: tmp, timeout });

const spec = (o: unknown) => fs.writeFileSync(path.join(tmp, "scrollcraft.json"), JSON.stringify(o));
const html = () => fs.readFileSync(path.join(tmp, "dist", "index.html"), "utf8");

function stubFrames(n: number) {
  fs.mkdirSync(path.join(tmp, "frames"), { recursive: true });
  for (let i = 0; i < n; i++) {
    fs.writeFileSync(path.join(tmp, "frames", `frame_${String(i).padStart(4, "0")}.jpg`), ONE_PX_JPEG);
  }
}

beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scrollcraft-verify-")); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe("skill section layouts", () => {
  it("applies a named layout instead of always centring", () => {
    stubFrames(1);
    spec({ sections: [{ heading: "A", layout: "lower-third" }] });
    expect(node(BUILD, ["--spec", "scrollcraft.json", "--out", "dist"]).status).toBe(0);
    const out = html();
    expect(out).toContain("align-items:flex-end");
    expect(out).toContain("text-align:left");
  });

  it("keeps distinct layouts distinct in the output", () => {
    stubFrames(1);
    spec({
      sections: [
        { heading: "A", layout: "left" },
        { heading: "B", layout: "right" },
      ],
    });
    expect(node(BUILD, ["--spec", "scrollcraft.json", "--out", "dist"]).status).toBe(0);
    const out = html();
    expect(out).toContain("justify-content:flex-start");
    expect(out).toContain("justify-content:flex-end");
  });

  it("rejects an unknown layout rather than silently centring it", () => {
    stubFrames(1);
    spec({ sections: [{ heading: "A", layout: "diagonal" }] });
    const run = node(BUILD, ["--spec", "scrollcraft.json", "--out", "dist"]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('unknown layout "diagonal"');
  });

  it("points out when every section shares one shape", () => {
    stubFrames(1);
    spec({ sections: [{ heading: "A" }, { heading: "B" }, { heading: "C" }] });
    const run = node(BUILD, ["--spec", "scrollcraft.json", "--out", "dist"]);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("same shape");
  });

  it("stays quiet when the layouts already vary", () => {
    stubFrames(1);
    spec({
      sections: [
        { heading: "A", layout: "center" },
        { heading: "B", layout: "left" },
        { heading: "C", layout: "lower-third" },
      ],
    });
    const run = node(BUILD, ["--spec", "scrollcraft.json", "--out", "dist"]);
    expect(run.status).toBe(0);
    expect(run.stdout).not.toContain("same shape");
  });

  it("left-aligned layouts do not centre their body copy with auto margins", () => {
    stubFrames(1);
    spec({ sections: [{ heading: "A", body: "text", layout: "left" }] });
    expect(node(BUILD, ["--spec", "scrollcraft.json", "--out", "dist"]).status).toBe(0);
    expect(html()).toContain("margin:0 0 1.5rem");
  });
});

describe("skill verify", () => {
  it("refuses to run against a directory with no build", () => {
    const run = node(VERIFY, ["--dir", "dist"]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("no index.html");
  });

  renderIt("passes a real built site and reports measured contrast", () => {
    expect(node(STYLE, ["--style", "aurora", "--count", "8", "--width", "640", "--out", "frames"]).status).toBe(0);
    spec({
      name: "Probe",
      sections: [
        { eyebrow: "Intro", heading: "Probe", body: "Readable copy over a dark frame.", scrollHeight: 1200 },
        { heading: "Second", layout: "left", body: "More copy.", scrollHeight: 1200 },
      ],
    });
    expect(node(BUILD, ["--spec", "scrollcraft.json", "--out", "dist"]).status).toBe(0);

    const run = node(VERIFY, ["--dir", "dist", "--samples", "5", "--shots", "shots"]);
    expect(run.stdout).toMatch(/worst copy contrast: [\d.]+:1/);
    expect(run.stdout).toContain("0 problem(s)");
    expect(run.status).toBe(0);

    const shots = fs.readdirSync(path.join(tmp, "shots"));
    expect(shots).toHaveLength(5);
    for (const s of shots) {
      expect(fs.readFileSync(path.join(tmp, "shots", s)).subarray(1, 4).toString()).toBe("PNG");
    }
  });

  renderIt("catches the silent black canvas when the frames are gone", () => {
    expect(node(STYLE, ["--style", "tide", "--count", "6", "--width", "640", "--out", "frames"]).status).toBe(0);
    spec({ name: "Probe", sections: [{ heading: "Probe", scrollHeight: 1200 }] });
    expect(node(BUILD, ["--spec", "scrollcraft.json", "--out", "dist"]).status).toBe(0);

    for (const f of fs.readdirSync(path.join(tmp, "dist", "frames"))) {
      fs.rmSync(path.join(tmp, "dist", "frames", f));
    }

    const run = node(VERIFY, ["--dir", "dist", "--samples", "4"]);
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("never painted");
  });

  renderIt("fails copy that cannot be read against the frame behind it", () => {
    expect(node(STYLE, [
      "--style", "tide", "--count", "6", "--width", "640", "--out", "frames",
      "--colors", "#ffffff,#fdfdfd,#ffffff",
    ]).status).toBe(0);
    spec({ name: "Probe", sections: [{ heading: "Unreadable", body: "White on white.", scrollHeight: 1200 }] });
    expect(node(BUILD, ["--spec", "scrollcraft.json", "--out", "dist"]).status).toBe(0);

    const run = node(VERIFY, ["--dir", "dist", "--samples", "4"]);
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("contrast");
    expect(run.stdout).toMatch(/needs 4\.5:1/);
  });

});
