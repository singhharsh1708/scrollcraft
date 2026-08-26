import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// These suites spawn ffmpeg, next build, and headless Chrome; the 5s default is exceeded
// under parallel load, causing flaky timeouts. Give them room.
vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPTS = path.resolve(__dirname, "../../plugins/scrollcraft/skills/scrollcraft/scripts");
const INIT = path.join(SCRIPTS, "init.mjs");
const STYLE = path.join(SCRIPTS, "frames-from-style.mjs");
const BUILD = path.join(SCRIPTS, "build-site.mjs");

const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
const ffmpegIt = hasFfmpeg ? it : it.skip;

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
const node = (script: string, args: string[]) =>
  spawnSync(process.execPath, [script, ...args], { encoding: "utf8", cwd: tmp });

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scrollcraft-scaffold-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("skill frames-from-style", () => {
  it("lists every style with a description", () => {
    const run = node(STYLE, ["--list"]);
    expect(run.status).toBe(0);
    for (const s of ["aurora", "nebula", "tide", "ember", "dusk", "monolith"]) {
      expect(run.stdout).toContain(s);
    }
  });

  it("rejects an unknown style rather than guessing one", () => {
    const run = node(STYLE, ["--style", "banana"]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('unknown style "banana"');
  });

  it("requires a style", () => {
    const run = node(STYLE, []);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("--style");
  });

  it("rejects a malformed colour", () => {
    const run = node(STYLE, ["--style", "aurora", "--colors", "#0b1026,nope"]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("6-digit hex");
  });

  it("rejects a colour list outside the filter's 2-8 range", () => {
    const run = node(STYLE, ["--style", "aurora", "--colors", "#0b1026"]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("between 2 and 8");
  });

  it("rejects an out-of-range frame count", () => {
    const run = node(STYLE, ["--style", "aurora", "--count", "99999"]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("--count");
  });

  ffmpegIt("renders a gap-free sequence the build accepts", () => {
    const run = node(STYLE, ["--style", "monolith", "--count", "6", "--width", "320", "--out", "frames"]);
    expect(run.status).toBe(0);
    const names = fs.readdirSync(path.join(tmp, "frames")).sort();
    expect(names).toEqual([
      "frame_0000.jpg", "frame_0001.jpg", "frame_0002.jpg",
      "frame_0003.jpg", "frame_0004.jpg", "frame_0005.jpg",
    ]);
  });

  ffmpegIt("produces frames that actually differ, or the scrub would be static", () => {
    expect(node(STYLE, ["--style", "aurora", "--count", "6", "--width", "320", "--out", "frames"]).status).toBe(0);
    const read = (n: string) => fs.readFileSync(path.join(tmp, "frames", n)).toString("base64");
    expect(read("frame_0000.jpg")).not.toEqual(read("frame_0005.jpg"));
  });

  ffmpegIt("keeps the built-in styles dark enough for white text", () => {
    const run = node(STYLE, ["--style", "nebula", "--count", "4", "--width", "320", "--out", "frames"]);
    expect(run.status).toBe(0);
    const peak = Number(/peak luma ([0-9.]+)/.exec(run.stdout)?.[1]);
    expect(peak).toBeLessThan(90);
  });

  ffmpegIt("warns when custom colours are too bright to carry white text", () => {
    const run = node(STYLE, [
      "--style", "tide", "--count", "4", "--width", "320", "--out", "frames",
      "--colors", "#ffffff,#fafafa,#ffffff",
    ]);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("bright for a background carrying white text");
  });
});

describe("skill init", () => {
  ffmpegIt("scaffolds a spec, frames and a built site in one command", () => {
    const run = node(INIT, ["--name", "Orrery", "--style", "tide", "--count", "4", "--width", "320"]);
    expect(run.status).toBe(0);

    const spec = JSON.parse(fs.readFileSync(path.join(tmp, "scrollcraft.json"), "utf8"));
    expect(spec.name).toBe("Orrery");
    expect(spec.sections.length).toBeGreaterThan(1);
    expect(spec.canvasAlt).toBeTruthy();

    const html = fs.readFileSync(path.join(tmp, "dist", "index.html"), "utf8");
    expect(html).toContain("<title>Orrery</title>");
    expect(html).toContain("var hasMobile = true;");
    expect(fs.readdirSync(path.join(tmp, "dist", "frames"))).toHaveLength(4);
    expect(fs.readdirSync(path.join(tmp, "dist", "frames-mobile"))).toHaveLength(4);
  });

  ffmpegIt("refuses to overwrite an existing spec without --force", () => {
    fs.writeFileSync(path.join(tmp, "scrollcraft.json"), '{"mine":true}');
    const run = node(INIT, ["--name", "X", "--count", "4", "--width", "320"]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("--force");
    expect(JSON.parse(fs.readFileSync(path.join(tmp, "scrollcraft.json"), "utf8")).mine).toBe(true);
  });

  it("fails on an unknown style before writing anything", () => {
    const run = node(INIT, ["--name", "X", "--style", "banana"]);
    expect(run.status).toBe(1);
    expect(fs.existsSync(path.join(tmp, "frames"))).toBe(false);
  });
});

describe("skill build-site section images", () => {
  const frames = () => {
    fs.mkdirSync(path.join(tmp, "frames"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "frames", "frame_0000.jpg"), ONE_PX_JPEG);
  };
  const spec = (o: unknown) => fs.writeFileSync(path.join(tmp, "scrollcraft.json"), JSON.stringify(o));
  const build = () => node(BUILD, ["--spec", "scrollcraft.json", "--out", "dist"]);
  const html = () => fs.readFileSync(path.join(tmp, "dist", "index.html"), "utf8");

  it("copies a section image into assets and renders it with its alt text", () => {
    frames();
    fs.writeFileSync(path.join(tmp, "logo.png"), ONE_PX_JPEG);
    spec({ sections: [{ heading: "A", image: "logo.png", imageAlt: "Orrery logo" }] });

    expect(build().status).toBe(0);
    expect(fs.existsSync(path.join(tmp, "dist", "assets", "img_00.png"))).toBe(true);
    expect(html()).toContain('src="assets/img_00.png"');
    expect(html()).toContain('alt="Orrery logo"');
  });

  it("warns when a section image has no alt text", () => {
    frames();
    fs.writeFileSync(path.join(tmp, "logo.png"), ONE_PX_JPEG);
    spec({ sections: [{ heading: "A", image: "logo.png" }] });

    const run = build();
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("imageAlt");
  });

  it("fails on a missing image rather than emitting a broken tag", () => {
    frames();
    spec({ sections: [{ heading: "A", image: "nope.png" }] });

    const run = build();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("image not found");
  });

  it("rejects an image type browsers will not render", () => {
    frames();
    fs.writeFileSync(path.join(tmp, "art.psd"), "nope");
    spec({ sections: [{ heading: "A", image: "art.psd" }] });

    const run = build();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("unsupported extension");
  });

  it("caps an oversized imageWidth instead of trusting it", () => {
    frames();
    fs.writeFileSync(path.join(tmp, "logo.png"), ONE_PX_JPEG);
    spec({ sections: [{ heading: "A", image: "logo.png", imageAlt: "x", imageWidth: 99999 }] });

    expect(build().status).toBe(0);
    expect(html()).toContain("max-width:min(100%, 1600px)");
  });

  it("escapes hostile alt text", () => {
    frames();
    fs.writeFileSync(path.join(tmp, "logo.png"), ONE_PX_JPEG);
    spec({ sections: [{ heading: "A", image: "logo.png", imageAlt: '"><script>alert(1)</script>' }] });

    expect(build().status).toBe(0);
    expect(html()).not.toContain("<script>alert(1)</script>");
  });
});
