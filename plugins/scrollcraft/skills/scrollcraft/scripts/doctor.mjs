#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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

const problems = [];
const warnings = [];
const notes = [];

function checkFfmpeg() {
  const probe = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) {
    warnings.push("ffmpeg not on PATH — video extraction unavailable (brew install ffmpeg / apt install ffmpeg)");
    return;
  }
  const first = String(probe.stdout || "").split("\n")[0];
  notes.push(first.trim());
}

function checkFrames(dir, label) {
  if (!fs.existsSync(dir)) {
    notes.push(`${label}: absent`);
    return 0;
  }
  const names = fs.readdirSync(dir).filter((n) => /^frame_\d{4}\.jpg$/.test(n));
  const stray = fs.readdirSync(dir).filter((n) => !/^frame_\d{4}\.jpg$/.test(n) && !n.startsWith("."));
  if (names.length === 0) {
    problems.push(`${label}: directory exists but holds no frame_NNNN.jpg files`);
    return 0;
  }
  const nums = names.map((n) => Number(n.slice(6, 10))).sort((a, b) => a - b);
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] !== i) {
      problems.push(`${label}: sequence has a gap — expected frame_${String(i).padStart(4, "0")}.jpg`);
      break;
    }
  }
  let bytes = 0;
  for (const n of names) bytes += fs.statSync(path.join(dir, n)).size;
  const mib = bytes / 1024 / 1024;
  notes.push(`${label}: ${names.length} frames, ${mib.toFixed(1)} MiB, avg ${(bytes / names.length / 1024).toFixed(0)} KiB`);
  if (stray.length) warnings.push(`${label}: ${stray.length} non-frame file(s) will be ignored by the build`);
  if (mib > 40) warnings.push(`${label}: ${mib.toFixed(1)} MiB is a heavy first load — consider lower fps or width`);
  return names.length;
}

function checkSpec(specPath) {
  if (!fs.existsSync(specPath)) {
    problems.push(`spec not found: ${specPath}`);
    return null;
  }
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  } catch (e) {
    problems.push(`spec is not valid JSON: ${e.message}`);
    return null;
  }
  if (!Array.isArray(spec.sections)) {
    problems.push("spec.sections must be an array");
    return spec;
  }
  const visible = spec.sections.filter((s) => s && s.visible !== false);
  if (visible.length === 0) problems.push("spec has no section with visible !== false");
  visible.forEach((s, i) => {
    if (!s.heading && !s.body && !s.eyebrow && !s.ctaLabel) {
      warnings.push(`section ${i} renders no text at all`);
    }
    const h = Number(s.scrollHeight);
    if (s.scrollHeight !== undefined && (!Number.isFinite(h) || h <= 0)) {
      problems.push(`section ${i} has a non-positive scrollHeight`);
    }
    if (Number.isFinite(h) && h > 0 && h < 400) {
      warnings.push(`section ${i} scrollHeight ${h}px is short — the copy will flash past`);
    }
    if (s.ctaLabel && !s.ctaHref) warnings.push(`section ${i} has a CTA label but no ctaHref`);
  });
  if (!spec.name) warnings.push("spec has no name — the page title will fall back to a generic one");
  if (!spec.description) warnings.push("spec has no description — no meta description or og:description will be emitted");
  return spec;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("Usage: doctor.mjs [--spec scrollcraft.json] [--frames frames] [--frames-mobile frames-mobile]\n");
    return;
  }

  const specPath = typeof args.spec === "string" ? args.spec : "scrollcraft.json";
  const spec = checkSpec(specPath);
  const specDir = path.dirname(path.resolve(specPath));

  const framesDir = path.resolve(specDir, typeof args.frames === "string" ? args.frames : (spec && spec.frames) || "frames");
  const desktop = checkFrames(framesDir, "frames");

  const mobileArg = typeof args["frames-mobile"] === "string" ? args["frames-mobile"] : (spec && spec.framesMobile) || "frames-mobile";
  const mobileDir = path.resolve(specDir, mobileArg);
  const mobile = checkFrames(mobileDir, "frames-mobile");

  if (desktop && !mobile) {
    warnings.push("no mobile frame set — phones will download the desktop frames");
  }

  if (spec && spec.audio) {
    const audioPath = path.resolve(specDir, spec.audio);
    if (!fs.existsSync(audioPath)) problems.push(`spec.audio not found: ${audioPath}`);
  }

  checkFfmpeg();

  for (const n of notes) process.stdout.write("  " + n + "\n");
  for (const w of warnings) process.stdout.write("warn: " + w + "\n");
  for (const p of problems) process.stdout.write("FAIL: " + p + "\n");

  process.stdout.write(`\n${problems.length} problem(s), ${warnings.length} warning(s)\n`);
  process.exit(problems.length ? 1 : 0);
}

main();
