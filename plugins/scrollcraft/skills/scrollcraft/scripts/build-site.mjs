#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(HERE, "..", "engine");

const AUDIO_EXT = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3",
  "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/mp4": "m4a",
  "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav",
  "audio/ogg": "ogg", "audio/webm": "webm", "audio/aac": "aac", "audio/flac": "flac",
};

const EXT_OK = new Set(Object.values(AUDIO_EXT));

function fail(msg) {
  process.stderr.write("build-site: " + msg + "\n");
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

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

function safeCss(s) {
  return String(s ?? "").replace(/[<>"'\\;{}]/g, "");
}

function safeHref(s) {
  const href = String(s ?? "");
  return /^https?:\/\//i.test(href) || href.startsWith("#") ? href : "#";
}

function safeCssBlock(s) {
  return String(s ?? "")
    .replace(/<\/?(script|style)/gi, "")
    .replace(/url\(\s*['"]?\s*(javascript|data):/gi, "url(")
    .replace(/expression\s*\(/gi, "");
}

function countFrames(dir) {
  if (!fs.existsSync(dir)) return 0;
  const names = fs.readdirSync(dir).filter((n) => /^frame_\d{4}\.jpg$/.test(n));
  if (names.length === 0) return 0;
  const nums = names.map((n) => Number(n.slice(6, 10))).sort((a, b) => a - b);
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] !== i) {
      fail(`frames in ${dir} are not a gap-free sequence starting at frame_0000.jpg (missing ${String(i).padStart(4, "0")})`);
    }
  }
  return nums.length;
}

function copyFrames(srcDir, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir)) {
    if (!/^frame_\d{4}\.jpg$/.test(name)) continue;
    fs.copyFileSync(path.join(srcDir, name), path.join(outDir, name));
  }
}

function renderSections(sections) {
  return sections.map((s) => {
    const height = Number(s.scrollHeight) || 1000;
    const parts = [];
    if (s.eyebrow) {
      parts.push(`<p class="eyebrow" style="font-size:0.875rem; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:${safeCss(s.accentColor || "#a78bfa")}; margin-bottom:0.75rem;">${esc(s.eyebrow)}</p>`);
    }
    if (s.heading) {
      parts.push(`<h2 style="font-size:clamp(2rem,5vw,4rem); font-weight:900; line-height:1; letter-spacing:-0.03em; color:${safeCss(s.headingColor || "#ffffff")}; margin-bottom:1rem;">${esc(s.heading)}</h2>`);
    }
    if (s.body) {
      parts.push(`<p style="font-size:1.125rem; line-height:1.7; color:${safeCss(s.bodyColor || "rgba(255,255,255,0.7)")}; max-width:600px; margin:0 auto 1.5rem;">${esc(s.body)}</p>`);
    }
    if (s.ctaLabel) {
      parts.push(`<a href="${esc(safeHref(s.ctaHref || "#"))}" style="display:inline-block; background:${safeCss(s.accentColor || "#7c3aed")}; color:#fff; padding:0.875rem 2rem; border-radius:0.5rem; font-weight:600; text-decoration:none; font-size:1rem;">${esc(s.ctaLabel)}</a>`);
    }
    return `    <section class="scroll-section" style="height:${height}px; position:relative; z-index:10;">
      <div class="section-sticky" style="position:sticky; top:0; height:100vh; display:flex; align-items:${safeCss(s.align || "center")}; justify-content:${safeCss(s.justify || "center")}; overflow:hidden;">
        <div class="section-content" style="text-align:${safeCss(s.textAlign || "center")}; padding:2rem; max-width:800px; opacity:0; transform:translateY(32px); transition:opacity 0.6s cubic-bezier(0.25,0.46,0.45,0.94),transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94);">
${parts.map((p) => "          " + p).join("\n")}
        </div>
      </div>
    </section>`;
  }).join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      "Usage: build-site.mjs --spec <scrollcraft.json> --out <dir> [--frames <dir>] [--frames-mobile <dir>] [--audio <file>]\n"
    );
    return;
  }

  const specPath = typeof args.spec === "string" ? args.spec : "scrollcraft.json";
  if (!fs.existsSync(specPath)) fail(`spec not found: ${specPath}`);

  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  } catch (e) {
    fail(`spec is not valid JSON: ${e.message}`);
  }

  const outDir = typeof args.out === "string" ? args.out : "dist";
  const specDir = path.dirname(path.resolve(specPath));
  const framesDir = path.resolve(specDir, typeof args.frames === "string" ? args.frames : spec.frames || "frames");
  const framesMobileArg = typeof args["frames-mobile"] === "string" ? args["frames-mobile"] : spec.framesMobile;
  const framesMobileDir = framesMobileArg ? path.resolve(specDir, framesMobileArg) : null;
  const audioArg = typeof args.audio === "string" ? args.audio : spec.audio;

  const sections = Array.isArray(spec.sections) ? spec.sections.filter((s) => s && s.visible !== false) : [];
  if (sections.length === 0) fail("spec needs at least one section with visible !== false");

  const desktopCount = countFrames(framesDir);
  if (desktopCount === 0) fail(`no frames found in ${framesDir} (expected frame_0000.jpg upward)`);
  const mobileCount = framesMobileDir ? countFrames(framesMobileDir) : 0;
  if (framesMobileDir && mobileCount === 0) fail(`--frames-mobile given but no frames found in ${framesMobileDir}`);

  const totalScrollHeight =
    sections.reduce((acc, s) => acc + (Number(s.scrollHeight) || 1000), 0) + 1000;

  let audioOut = "";
  if (audioArg) {
    const audioPath = path.resolve(specDir, audioArg);
    if (!fs.existsSync(audioPath)) fail(`audio file not found: ${audioPath}`);
    const ext = path.extname(audioPath).slice(1).toLowerCase();
    if (!EXT_OK.has(ext)) fail(`unsupported audio extension ".${ext}" (allowed: ${[...EXT_OK].join(", ")})`);
    audioOut = "audio." + ext;
    fs.mkdirSync(outDir, { recursive: true });
    fs.copyFileSync(audioPath, path.join(outDir, audioOut));
  }

  const css = fs.readFileSync(path.join(ENGINE, "scrollcraft.css"), "utf8");
  const runtime = fs
    .readFileSync(path.join(ENGINE, "scrollcraft.runtime.js"), "utf8")
    .replace(/__DESKTOP_COUNT__/g, String(desktopCount))
    .replace(/__MOBILE_COUNT__/g, String(mobileCount))
    .replace(/__HAS_MOBILE__/g, mobileCount > 0 ? "true" : "false")
    .replace(/__TOTAL_SCROLL__/g, String(totalScrollHeight))
    .replace(/__FRAMES_DIR__/g, "frames")
    .replace(/__FRAMES_MOBILE_DIR__/g, "frames-mobile")
    .replace(/__HAS_AUDIO__/g, audioOut ? "true" : "false")
    .replace(/__AUDIO_SRC__/g, audioOut);

  const title = esc(spec.name || "ScrollCraft Site");
  const description = esc(spec.description || "");
  const customCss = safeCssBlock(spec.customCss || "");

  const html = `<!DOCTYPE html>
<html lang="${esc(spec.lang || "en")}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
${description ? `  <meta name="description" content="${description}" />\n` : ""}  <meta property="og:title" content="${title}" />
${description ? `  <meta property="og:description" content="${description}" />\n` : ""}  <meta property="og:type" content="website" />
  <style>
${css}
  </style>
${customCss ? `  <style>\n${customCss}\n  </style>\n` : ""}</head>
<body>
  <canvas id="scroll-canvas" role="img" aria-label="${esc(spec.canvasAlt || title)}"></canvas>
  <div id="scroll-container" style="height:${totalScrollHeight}px;">
    <div style="height:100vh;"></div>
${renderSections(sections)}
  </div>
  <div id="scroll-hint" aria-hidden="true">
    <span>Scroll</span>
    <div class="arrow"></div>
  </div>
${audioOut ? `  <button id="audio-mute" type="button" aria-label="Unmute background audio">🔇</button>\n` : ""}  <noscript>
    <div style="position:relative; z-index:40; padding:2rem; text-align:center;">
      This site animates a frame sequence as you scroll and needs JavaScript enabled.
    </div>
  </noscript>
  <script>
${runtime}
  </script>
</body>
</html>
`;

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  copyFrames(framesDir, path.join(outDir, "frames"));
  if (framesMobileDir) copyFrames(framesMobileDir, path.join(outDir, "frames-mobile"));

  process.stdout.write(
    `built ${path.join(outDir, "index.html")}\n` +
    `  sections: ${sections.length}\n` +
    `  desktop frames: ${desktopCount}\n` +
    `  mobile frames: ${mobileCount}\n` +
    `  scroll track: ${totalScrollHeight}px\n` +
    `  audio: ${audioOut || "none"}\n`
  );
}

main();
