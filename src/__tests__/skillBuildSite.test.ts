import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT = path.resolve(
  __dirname,
  "../../plugins/scrollcraft/skills/scrollcraft/scripts/build-site.mjs"
);

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

function writeFrames(dir: string, indices: number[]) {
  fs.mkdirSync(dir, { recursive: true });
  for (const i of indices) {
    fs.writeFileSync(path.join(dir, `frame_${String(i).padStart(4, "0")}.jpg`), ONE_PX_JPEG);
  }
}

function writeSpec(spec: unknown) {
  fs.writeFileSync(path.join(tmp, "scrollcraft.json"), JSON.stringify(spec));
}

function build(extra: string[] = []) {
  return spawnSync(
    process.execPath,
    [SCRIPT, "--spec", path.join(tmp, "scrollcraft.json"), "--out", path.join(tmp, "dist"), ...extra],
    { encoding: "utf8" }
  );
}

function html() {
  return fs.readFileSync(path.join(tmp, "dist", "index.html"), "utf8");
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scrollcraft-skill-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("skill build-site", () => {
  it("builds a bundle and copies the frame sequence", () => {
    writeFrames(path.join(tmp, "frames"), [0, 1, 2]);
    writeSpec({
      name: "Orrery",
      description: "A precision instrument.",
      sections: [{ heading: "One", scrollHeight: 1200 }, { heading: "Two", scrollHeight: 800 }],
    });

    const run = build();
    expect(run.status).toBe(0);

    const out = html();
    expect(out).toContain("<title>Orrery</title>");
    expect(out).toContain('name="description" content="A precision instrument."');
    expect(out).toContain("Two");
    expect(fs.readdirSync(path.join(tmp, "dist", "frames"))).toHaveLength(3);
  });

  it("sets the scroll track to the sum of section heights plus 1000", () => {
    writeFrames(path.join(tmp, "frames"), [0, 1]);
    writeSpec({ sections: [{ heading: "A", scrollHeight: 1200 }, { heading: "B", scrollHeight: 900 }] });

    expect(build().status).toBe(0);
    const out = html();
    expect(out).toContain("height:3100px");
    expect(out).toContain("var totalScrollHeight = 3100;");
  });

  it("excludes sections marked visible:false from output and from the track total", () => {
    writeFrames(path.join(tmp, "frames"), [0]);
    writeSpec({
      sections: [
        { heading: "Shown", scrollHeight: 1000 },
        { heading: "Draft copy", scrollHeight: 5000, visible: false },
      ],
    });

    expect(build().status).toBe(0);
    const out = html();
    expect(out).toContain("Shown");
    expect(out).not.toContain("Draft copy");
    expect(out).toContain("var totalScrollHeight = 2000;");
  });

  it("injects the real frame counts into the runtime", () => {
    writeFrames(path.join(tmp, "frames"), [0, 1, 2, 3]);
    writeFrames(path.join(tmp, "frames-mobile"), [0, 1]);
    writeSpec({ framesMobile: "frames-mobile", sections: [{ heading: "A" }] });

    expect(build().status).toBe(0);
    const out = html();
    expect(out).toContain("var desktopCount = 4;");
    expect(out).toContain("var mobileCount = 2;");
    expect(out).toContain("var hasMobile = true;");
  });

  it("reports hasMobile false when no mobile set is supplied", () => {
    writeFrames(path.join(tmp, "frames"), [0]);
    writeSpec({ sections: [{ heading: "A" }] });

    expect(build().status).toBe(0);
    expect(html()).toContain("var hasMobile = false;");
  });

  it("refuses a gapped frame sequence instead of shipping a stutter", () => {
    writeFrames(path.join(tmp, "frames"), [0, 1, 3]);
    writeSpec({ sections: [{ heading: "A" }] });

    const run = build();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("gap-free");
    expect(fs.existsSync(path.join(tmp, "dist", "index.html"))).toBe(false);
  });

  it("refuses a spec whose every section is hidden", () => {
    writeFrames(path.join(tmp, "frames"), [0]);
    writeSpec({ sections: [{ heading: "A", visible: false }] });

    const run = build();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("at least one section");
  });

  it("refuses a frames directory with no frames", () => {
    fs.mkdirSync(path.join(tmp, "frames"));
    writeSpec({ sections: [{ heading: "A" }] });

    const run = build();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("no frames found");
  });

  it("escapes HTML in section copy", () => {
    writeFrames(path.join(tmp, "frames"), [0]);
    writeSpec({
      name: '</title><script>alert(1)</script>',
      sections: [{ heading: '<img src=x onerror=alert(1)>', body: 'a & b' }],
    });

    expect(build().status).toBe(0);
    const out = html();
    expect(out).not.toContain("<script>alert(1)</script>");
    expect(out).not.toContain("<img src=x");
    expect(out).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(out).toContain("a &amp; b");
  });

  it("neutralises a javascript: CTA href", () => {
    writeFrames(path.join(tmp, "frames"), [0]);
    writeSpec({
      sections: [{ heading: "A", ctaLabel: "Go", ctaHref: "javascript:alert(1)" }],
    });

    expect(build().status).toBe(0);
    const out = html();
    expect(out).not.toContain("javascript:alert");
    expect(out).toContain('href="#"');
  });

  it("strips declaration-breaking characters from colour fields", () => {
    writeFrames(path.join(tmp, "frames"), [0]);
    writeSpec({
      sections: [
        { heading: "A", headingColor: "#fff;background-image:url(https://tracker/x.png)" },
      ],
    });

    expect(build().status).toBe(0);
    const out = html();
    expect(out).not.toContain("#fff;background-image");
    expect(out).toContain("#fffbackground-image");
  });

  it("rejects an audio file whose extension no static host serves correctly", () => {
    writeFrames(path.join(tmp, "frames"), [0]);
    fs.writeFileSync(path.join(tmp, "track.aiff"), "not audio");
    writeSpec({ audio: "track.aiff", sections: [{ heading: "A" }] });

    const run = build();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("unsupported audio extension");
  });

  it("copies allowed audio and wires the mute control", () => {
    writeFrames(path.join(tmp, "frames"), [0]);
    fs.writeFileSync(path.join(tmp, "track.mp3"), "not really audio");
    writeSpec({ audio: "track.mp3", sections: [{ heading: "A" }] });

    expect(build().status).toBe(0);
    const out = html();
    expect(fs.existsSync(path.join(tmp, "dist", "audio.mp3"))).toBe(true);
    expect(out).toContain('id="audio-mute"');
    expect(out).toContain("var audio = new Audio('audio.mp3');");
  });

  it("omits the audio control entirely when no audio is specified", () => {
    writeFrames(path.join(tmp, "frames"), [0]);
    writeSpec({ sections: [{ heading: "A" }] });

    expect(build().status).toBe(0);
    const out = html();
    expect(out).not.toContain('id="audio-mute"');
    expect(out).toContain("if (false) {");
  });

  it("fails on a missing spec rather than emitting an empty site", () => {
    const run = build();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("spec not found");
  });

  it("leaves no external network references in the bundle", () => {
    writeFrames(path.join(tmp, "frames"), [0]);
    writeSpec({ sections: [{ heading: "A" }] });

    expect(build().status).toBe(0);
    const out = html();
    expect(out).not.toMatch(/<script[^>]+src=/);
    expect(out).not.toMatch(/<link[^>]+href="https?:/);
  });
});
