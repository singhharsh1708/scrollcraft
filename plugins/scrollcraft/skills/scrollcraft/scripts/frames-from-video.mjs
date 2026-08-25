#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function fail(msg) {
  process.stderr.write("frames-from-video: " + msg + "\n");
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function intArg(value, fallback, min, max, label) {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) fail(`${label} must be an integer`);
  if (n < min || n > max) fail(`${label} must be between ${min} and ${max}`);
  return n;
}

function haveFfmpeg() {
  const probe = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  return !probe.error && probe.status === 0;
}

function extract(input, outDir, fps, width, quality) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of fs.readdirSync(outDir)) {
    if (/^frame_\d{4}\.jpg$/.test(name)) fs.rmSync(path.join(outDir, name));
  }
  const args = [
    "-hide_banner",
    "-loglevel", "error",
    "-i", input,
    "-vf", `fps=${fps},scale=${width}:-2:flags=lanczos`,
    "-q:v", String(quality),
    "-start_number", "0",
    path.join(outDir, "frame_%04d.jpg"),
  ];
  const run = spawnSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
  if (run.error) fail(`failed to run ffmpeg: ${run.error.message}`);
  if (run.status !== 0) fail(`ffmpeg exited with status ${run.status}`);
  const produced = fs.readdirSync(outDir).filter((n) => /^frame_\d{4}\.jpg$/.test(n));
  if (produced.length === 0) fail(`ffmpeg produced no frames from ${input}`);
  if (produced.length > 9999) fail(`${produced.length} frames exceeds the frame_%04d naming space`);
  let bytes = 0;
  for (const name of produced) bytes += fs.statSync(path.join(outDir, name)).size;
  return { count: produced.length, bytes };
}

function mib(bytes) {
  return (bytes / 1024 / 1024).toFixed(1) + " MiB";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      "Usage: frames-from-video.mjs --input <video> [--out frames] [--fps 24] [--width 1920]\n" +
      "                            [--quality 4] [--mobile-width 828] [--mobile-out frames-mobile]\n"
    );
    return;
  }

  const input = typeof args.input === "string" ? args.input : null;
  if (!input) fail("--input <video> is required");
  if (!fs.existsSync(input)) fail(`input not found: ${input}`);
  if (!fs.statSync(input).isFile()) fail(`input is not a file: ${input}`);

  if (!haveFfmpeg()) {
    fail("ffmpeg not found on PATH. Install it (macOS: brew install ffmpeg, Debian: apt install ffmpeg) and retry.");
  }

  const outDir = typeof args.out === "string" ? args.out : "frames";
  const fps = intArg(args.fps, 24, 1, 60, "--fps");
  const width = intArg(args.width, 1920, 320, 3840, "--width");
  const quality = intArg(args.quality, 4, 1, 31, "--quality");

  const desktop = extract(input, outDir, fps, width, quality);
  process.stdout.write(`${outDir}: ${desktop.count} frames, ${mib(desktop.bytes)}\n`);

  let mobile = null;
  if (args["mobile-width"] !== undefined || args["mobile-out"] !== undefined) {
    const mobileWidth = intArg(args["mobile-width"], 828, 320, 1600, "--mobile-width");
    const mobileOut = typeof args["mobile-out"] === "string" ? args["mobile-out"] : "frames-mobile";
    mobile = extract(input, mobileOut, fps, mobileWidth, quality);
    process.stdout.write(`${mobileOut}: ${mobile.count} frames, ${mib(mobile.bytes)}\n`);
  }

  const total = desktop.bytes + (mobile ? mobile.bytes : 0);
  if (total > 60 * 1024 * 1024) {
    process.stdout.write(
      `warning: ${mib(total)} of frames is a heavy first load. Lower --fps or --width, or raise --quality.\n`
    );
  }
  if (!mobile) {
    process.stdout.write(
      "note: no mobile set built. Pass --mobile-width 828 so phones do not download desktop frames.\n"
    );
  }
}

main();
