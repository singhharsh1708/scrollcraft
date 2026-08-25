#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const RATE = 25;
const LUMA_WARN = 90;

const STYLES = {
  aurora: {
    blurb: "cold blue-teal spiral, slow drift",
    colors: ["0x0b1026", "0x1b3a6b", "0x2f7d8c", "0x0b1026"],
    type: "spiral", speed: 0.06, seed: 7, post: "vignette=PI/5",
  },
  nebula: {
    blurb: "deep violet and blue, soft-focus",
    colors: ["0x07030f", "0x2b1055", "0x6b2d8f", "0x1b6ba8", "0x07030f"],
    type: "circular", speed: 0.04, seed: 11, post: "vignette=PI/4,gblur=sigma=1.2",
  },
  tide: {
    blurb: "dark teal linear sweep",
    colors: ["0x01090d", "0x073038", "0x14707d", "0x02121a"],
    type: "linear", speed: 0.03, seed: 5, post: "vignette=PI/4",
  },
  ember: {
    blurb: "warm rust glow on near-black",
    colors: ["0x0d0503", "0x3d1206", "0x8c3a0d", "0x2a0d05", "0x0d0503"],
    type: "radial", speed: 0.05, seed: 3, post: "vignette=PI/4,gblur=sigma=1.6",
  },
  dusk: {
    blurb: "plum and clay, square falloff",
    colors: ["0x120b1a", "0x3a1d3d", "0x8a4a55", "0x1d1024", "0x120b1a"],
    type: "square", speed: 0.045, seed: 19, post: "vignette=PI/4",
  },
  monolith: {
    blurb: "graphite and steel, near-monochrome",
    colors: ["0x0a0c0f", "0x1e262e", "0x46545f", "0x0c0f13"],
    type: "square", speed: 0.035, seed: 23, post: "vignette=PI/5",
  },
};

function fail(msg) {
  process.stderr.write("frames-from-style: " + msg + "\n");
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

function intArg(v, fallback, min, max, label) {
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n)) fail(`${label} must be an integer`);
  if (n < min || n > max) fail(`${label} must be between ${min} and ${max}`);
  return n;
}

function haveFfmpeg() {
  const p = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  return !p.error && p.status === 0;
}

function normalizeColor(c, i) {
  const s = String(c).trim().replace(/^#/, "").replace(/^0x/i, "");
  if (!/^[0-9a-f]{6}$/i.test(s)) fail(`--colors entry ${i + 1} ("${c}") must be a 6-digit hex colour`);
  return "0x" + s.toLowerCase();
}

function source(style, width, height, colors, speed, seed) {
  const parts = [
    `s=${width}x${height}`, `r=${RATE}`, `n=${colors.length}`,
    ...colors.map((c, i) => `c${i}=${c}`),
    `type=${style.type}`, `speed=${speed}`, `seed=${seed}`,
  ];
  return "gradients=" + parts.join(":");
}

function peakLuma(src, post, frames) {
  const r = spawnSync("ffmpeg", [
    "-hide_banner", "-f", "lavfi", "-i", src,
    "-vf", `${post},signalstats,metadata=print`,
    "-frames:v", String(Math.min(frames, 6)), "-f", "null", "-",
  ], { encoding: "utf8" });
  const vals = [...String(r.stderr || "").matchAll(/YAVG=([0-9.]+)/g)].map((m) => Number(m[1]));
  return vals.length ? Math.max(...vals) : null;
}

function render(src, post, outDir, count, quality) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of fs.readdirSync(outDir)) {
    if (/^frame_\d{4}\.jpg$/.test(name)) fs.rmSync(path.join(outDir, name));
  }
  const r = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", src,
    "-vf", post,
    "-frames:v", String(count),
    "-q:v", String(quality),
    "-start_number", "0",
    path.join(outDir, "frame_%04d.jpg"),
  ], { stdio: ["ignore", "inherit", "inherit"] });
  if (r.error) fail(`failed to run ffmpeg: ${r.error.message}`);
  if (r.status !== 0) fail(`ffmpeg exited with status ${r.status}`);
  const made = fs.readdirSync(outDir).filter((n) => /^frame_\d{4}\.jpg$/.test(n));
  if (made.length !== count) fail(`expected ${count} frames, ffmpeg produced ${made.length}`);
  let bytes = 0;
  for (const n of made) bytes += fs.statSync(path.join(outDir, n)).size;
  return { count: made.length, bytes };
}

function mib(b) { return (b / 1024 / 1024).toFixed(1) + " MiB"; }

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list || args.help) {
    process.stdout.write(
      "Usage: frames-from-style.mjs --style <name> [--out frames] [--count 180] [--width 1920]\n" +
      "                            [--mobile-width 828] [--mobile-out frames-mobile]\n" +
      "                            [--colors '#0b1026,#1b3a6b,...'] [--speed 0.05] [--seed 7] [--quality 4]\n\nStyles:\n"
    );
    for (const [k, v] of Object.entries(STYLES)) {
      process.stdout.write(`  ${k.padEnd(9)} ${v.blurb}\n`);
    }
    return;
  }

  const name = typeof args.style === "string" ? args.style : null;
  if (!name) fail("--style <name> is required. Run with --list to see the styles.");
  const style = STYLES[name];
  if (!style) fail(`unknown style "${name}". Run with --list to see the styles.`);

  if (!haveFfmpeg()) {
    fail("ffmpeg not found on PATH. Install it (macOS: brew install ffmpeg, Debian: apt install ffmpeg) and retry.");
  }

  const outDir = typeof args.out === "string" ? args.out : "frames";
  const count = intArg(args.count, 180, 2, 9999, "--count");
  const width = intArg(args.width, 1920, 320, 3840, "--width");
  const quality = intArg(args.quality, 4, 1, 31, "--quality");
  const seed = intArg(args.seed, style.seed, 0, 4294967295, "--seed");

  let speed = style.speed;
  if (args.speed !== undefined) {
    speed = Number(args.speed);
    if (!Number.isFinite(speed) || speed <= 0 || speed > 1) fail("--speed must be between 0 and 1");
  }

  let colors = style.colors;
  if (typeof args.colors === "string") {
    const list = args.colors.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length < 2 || list.length > 8) fail("--colors needs between 2 and 8 comma-separated hex colours");
    colors = list.map(normalizeColor);
  }

  const height = Math.round(width * 9 / 16 / 2) * 2;
  const src = source(style, width, height, colors, speed, seed);
  const peak = peakLuma(src, style.post, count);
  if (peak !== null && peak > LUMA_WARN) {
    process.stdout.write(
      `warning: peak average luma ${peak.toFixed(1)} is bright for a background carrying white text. ` +
      `Darken the first and last --colors entries.\n`
    );
  }

  const desktop = render(src, style.post, outDir, count, quality);
  process.stdout.write(`${outDir}: ${desktop.count} frames, ${mib(desktop.bytes)}` +
    (peak !== null ? `, peak luma ${peak.toFixed(1)}` : "") + "\n");

  let mobile = null;
  if (args["mobile-width"] !== undefined || args["mobile-out"] !== undefined) {
    const mw = intArg(args["mobile-width"], 828, 320, 1600, "--mobile-width");
    const mOut = typeof args["mobile-out"] === "string" ? args["mobile-out"] : "frames-mobile";
    const mh = Math.round(mw * 9 / 16 / 2) * 2;
    mobile = render(source(style, mw, mh, colors, speed, seed), style.post, mOut, count, quality);
    process.stdout.write(`${mOut}: ${mobile.count} frames, ${mib(mobile.bytes)}\n`);
  } else {
    process.stdout.write("note: no mobile set built. Pass --mobile-width 828 so phones do not download desktop frames.\n");
  }
}

main();
