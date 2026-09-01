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

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "avif", "gif", "svg"]);

const KINDS = new Set(["text", "statement", "spacer"]);
const REVEALS = new Set(["rise", "fade", "mask", "stagger", "scale", "none"]);

const TYPE_SCALES = {
  compact: { heading: "clamp(1.6rem,3.4vw,2.6rem)", body: "1rem", measure: 560 },
  editorial: { heading: "clamp(2rem,5vw,4rem)", body: "1.125rem", measure: 600 },
  poster: { heading: "clamp(2.6rem,8vw,6.5rem)", body: "1.25rem", measure: 640 },
};

const FONT_RE = /^[A-Za-z0-9][A-Za-z0-9 ]*$/;

function themeCss(theme) {
  if (!theme || typeof theme !== "object") return "";
  const scale = TYPE_SCALES[theme.scale] || TYPE_SCALES.editorial;
  const v = [];
  if (theme.fontDisplay) v.push(`  --sc-font-display: '${theme.fontDisplay}', system-ui, sans-serif;`);
  if (theme.fontBody) v.push(`  --sc-font-body: '${theme.fontBody}', system-ui, sans-serif;`);
  if (theme.displayWeight) v.push(`  --sc-display-weight: ${Math.min(Math.max(Number(theme.displayWeight) || 800, 100), 900)};`);
  if (theme.displayCase === "upper") v.push("  --sc-display-case: uppercase;");
  if (theme.displayTracking !== undefined) {
    const tr = Math.min(Math.max(Number(theme.displayTracking) || 0, -0.08), 0.4);
    v.push(`  --sc-display-tracking: ${tr}em;`);
  }
  if (theme.ink) v.push(`  --sc-ink: ${safeCss(theme.ink)};`);
  if (theme.ground) v.push(`  --sc-ground: ${safeCss(theme.ground)};`);
  if (theme.muted) v.push(`  --sc-muted: ${safeCss(theme.muted)};`);
  if (theme.accent) v.push(`  --sc-accent: ${safeCss(theme.accent)};`);
  if (theme.accentText) v.push(`  --sc-accent-text: ${safeCss(theme.accentText)};`);
  if (theme.radius !== undefined) v.push(`  --sc-radius: ${Math.min(Math.max(Number(theme.radius) || 0, 0), 64)}px;`);
  v.push(`  --sc-heading-size: ${scale.heading};`);
  v.push(`  --sc-body-size: ${scale.body};`);
  v.push(`  --sc-measure: ${scale.measure}px;`);
  return `:root {\n${v.join("\n")}\n}`;
}

function themeHead(theme) {
  if (!theme || typeof theme !== "object") return "";
  const fams = [];
  for (const f of [theme.fontDisplay, theme.fontBody]) {
    if (!f) continue;
    if (!FONT_RE.test(f)) fail(`theme font "${f}" may contain only letters, digits and spaces`);
    if (!fams.includes(f)) fams.push(f);
  }
  if (!fams.length) return "";
  // Ask for the weight the theme declares, not a fixed 400/600/800. displayWeight is
  // free between 100 and 900, and a face that does not serve the requested weight is
  // matched to a neighbour: Space Grotesk stops at 600, so tide's 700 display rendered
  // at 600, while Fraunces and Playfair Display jumped 700 up to 800.
  const weights = [...new Set([400, 600, Number(theme.displayWeight) || 800])].sort((a, b) => a - b);
  const q = fams.map((f) => `family=${f.replace(/ /g, "+")}:wght@${weights.join(";")}`).join("&");
  return [
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${q}&display=swap" />`,
  ].join("\n  ");
}

const LAYOUTS = {
  center: { align: "center", justify: "center", textAlign: "center", maxWidth: 800, pad: "2rem" },
  left: { align: "center", justify: "flex-start", textAlign: "left", maxWidth: 620, pad: "2rem clamp(2rem, 8vw, 8rem)" },
  right: { align: "center", justify: "flex-end", textAlign: "left", maxWidth: 620, pad: "2rem clamp(2rem, 8vw, 8rem)" },
  "lower-third": { align: "flex-end", justify: "flex-start", textAlign: "left", maxWidth: 900, pad: "0 clamp(2rem, 8vw, 8rem) clamp(3rem, 10vh, 7rem)" },
  "upper-third": { align: "flex-start", justify: "center", textAlign: "center", maxWidth: 800, pad: "clamp(3rem, 12vh, 8rem) 2rem 0" },
};

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

// An allowlist, matching the app's exporter: a scheme that executes never reaches the
// page, and // is excluded because it leaves the origin rather than naming a local path.
function safeHref(s) {
  const href = String(s ?? "").trim();
  if (href.startsWith("//")) return "#";
  return /^(?:https?:\/\/|mailto:|tel:|#|\/|\.{1,2}\/)/i.test(href) ? href : "#";
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

function renderSections(sections, images, specScrim) {
  return sections.map((s, idx) => {
    const height = Number(s.scrollHeight) || 1000;
    const L = LAYOUTS[s.layout] || LAYOUTS.center;
    const parts = [];
    const img = images.get(idx);
    if (img) {
      const w = Number(s.imageWidth);
      const cap = Number.isFinite(w) && w > 0 ? Math.min(w, 1600) : 480;
      const m = L.textAlign === "center" ? "0 auto 1.5rem" : "0 0 1.5rem";
      parts.push(`<img src="${esc(img)}" alt="${esc(s.imageAlt || "")}" style="display:block; max-width:min(100%, ${cap}px); height:auto; margin:${m};" />`);
    }
    if (s.eyebrow) {
      parts.push(`<p class="eyebrow" style="font-size:0.875rem; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:${safeCss(s.accentColor || "var(--sc-accent-text, #ede9fe)")}; margin-bottom:0.75rem;">${esc(s.eyebrow)}</p>`);
    }
    if (s.heading) {
      const statement = s.kind === "statement";
      const hClass = statement ? "sc-display sc-statement" : "sc-display";
      const hStyle = statement
        ? `color:${safeCss(s.headingColor || "var(--sc-ink, #ffffff)")}; margin-bottom:1rem;`
        : `font-size:var(--sc-heading-size, clamp(2rem,5vw,4rem)); font-weight:var(--sc-display-weight, 900); line-height:1; letter-spacing:var(--sc-display-tracking, -0.03em); text-transform:var(--sc-display-case, none); color:${safeCss(s.headingColor || "var(--sc-ink, #ffffff)")}; margin-bottom:1rem;`;
      parts.push(`<h2 class="${hClass}" style="${hStyle}">${esc(s.heading)}</h2>`);
    }
    const bodyMargin = L.textAlign === "center" ? "0 auto 1.5rem" : "0 0 1.5rem";
    if (s.body) {
      parts.push(`<p style="font-size:var(--sc-body-size, 1.125rem); line-height:1.7; color:${safeCss(s.bodyColor || "var(--sc-muted, rgba(255,255,255,0.72))")}; max-width:var(--sc-measure, 600px); margin:${bodyMargin};">${esc(s.body)}</p>`);
    }
    if (s.ctaLabel) {
      parts.push(`<a href="${esc(safeHref(s.ctaHref || "#"))}" style="display:inline-block; background:${safeCss(s.accentColor || "var(--sc-accent, #7c3aed)")}; color:#fff; padding:0.875rem 2rem; border-radius:var(--sc-radius, 0.5rem); font-weight:600; text-decoration:none; font-size:1rem;">${esc(s.ctaLabel)}</a>`);
    }
    if (s.kind === "spacer") {
      return `    <section class="scroll-section" aria-hidden="true" style="height:${height}px; position:relative; z-index:10;"></section>`;
    }

    const reveal = REVEALS.has(s.reveal) ? s.reveal : "rise";
    const scrimRaw = s.scrim !== undefined ? Number(s.scrim) : Number(specScrim);
    const scrim = Number.isFinite(scrimRaw) ? Math.min(Math.max(scrimRaw, 0), 1) : 0;
    return `    <section class="scroll-section" style="height:${height}px; position:relative; z-index:10;">
      <div class="section-sticky" style="position:sticky; top:0; height:100vh; display:flex; align-items:${safeCss(s.align || L.align)}; justify-content:${safeCss(s.justify || L.justify)}; overflow:hidden;">
        <div class="section-content" data-reveal="${reveal}" style="${scrim > 0 ? `background:radial-gradient(ellipse 120% 100% at 50% 50%, rgba(0,0,0,${scrim}) 0%, rgba(0,0,0,${(scrim * 0.72).toFixed(3)}) 45%, rgba(0,0,0,0) 78%); ` : ""}text-align:${safeCss(s.textAlign || L.textAlign)}; padding:${L.pad}; max-width:${L.maxWidth}px; transition:opacity 0.6s cubic-bezier(0.25,0.46,0.45,0.94),transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94),clip-path 0.7s cubic-bezier(0.25,0.46,0.45,0.94);">
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

  sections.forEach((s, i) => {
    if (s.layout !== undefined && !LAYOUTS[s.layout]) {
      fail(`section ${i} has unknown layout "${s.layout}" (allowed: ${Object.keys(LAYOUTS).join(", ")})`);
    }
    if (s.kind !== undefined && !KINDS.has(s.kind)) {
      fail(`section ${i} has unknown kind "${s.kind}" (allowed: ${[...KINDS].join(", ")})`);
    }
    if (s.reveal !== undefined && !REVEALS.has(s.reveal)) {
      fail(`section ${i} has unknown reveal "${s.reveal}" (allowed: ${[...REVEALS].join(", ")})`);
    }
  });

  if (sections.length > 2) {
    const used = new Set(sections.map((s) => s.layout || "center"));
    if (used.size === 1) {
      process.stdout.write(
        `note: all ${sections.length} sections use the "${[...used][0]}" layout, so every screen has the same shape. ` +
        `Vary "layout" (${Object.keys(LAYOUTS).join(", ")}) so the page does not read as a template.\n`
      );
    }
  }

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

  const images = new Map();
  sections.forEach((s, idx) => {
    if (!s.image) return;
    const src = path.resolve(specDir, s.image);
    if (!fs.existsSync(src)) fail(`section ${idx} image not found: ${src}`);
    const ext = path.extname(src).slice(1).toLowerCase();
    if (!IMAGE_EXT.has(ext)) {
      fail(`section ${idx} image has unsupported extension ".${ext}" (allowed: ${[...IMAGE_EXT].join(", ")})`);
    }
    if (!s.imageAlt) {
      process.stdout.write(`warning: section ${idx} has an image but no imageAlt, so screen readers get nothing\n`);
    }
    const name = `img_${String(idx).padStart(2, "0")}.${ext}`;
    fs.mkdirSync(path.join(outDir, "assets"), { recursive: true });
    fs.copyFileSync(src, path.join(outDir, "assets", name));
    images.set(idx, `assets/${name}`);
  });

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

  const leftover = runtime.match(/__[A-Z][A-Z0-9_]*__/g);
  if (leftover) {
    fail(`engine placeholder(s) never substituted: ${[...new Set(leftover)].join(", ")}`);
  }

  const specScrim = (spec.theme && spec.theme.scrim !== undefined) ? spec.theme.scrim : 0;
  const themeStyles = themeCss(spec.theme);
  const fontLinks = themeHead(spec.theme);
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
${fontLinks ? `  ${fontLinks}\n` : ""}  <style>
${themeStyles ? themeStyles + "\n" : ""}${css}
  </style>
${customCss ? `  <style>\n${customCss}\n  </style>\n` : ""}</head>
<body>
  <canvas id="scroll-canvas" role="img" aria-label="${esc(spec.canvasAlt || title)}"></canvas>
  <div id="scroll-container" style="height:${totalScrollHeight}px;">
    <div style="height:100vh;"></div>
${renderSections(sections, images, specScrim)}
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
