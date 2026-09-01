import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { REVEALS, exportSectionsSchema, type Section, visibleSections as onlyVisible } from "@/lib/siteSchema";
import { layoutStyle } from "@/lib/layoutStyles";
import { parseThemeJson, parseStyleJson } from "@/lib/siteSchema";
import { proceduralRuntimeSource } from "@/lib/generate2DFrames";
import { compileTheme, varsToCss } from "@/lib/themeCss";

function esc(s: unknown): string {
  return String(s ?? "")
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}


/**
 * The scroll track a section occupies.
 *
 * Clamped the way imageWidth and scrim already are. `Number(x) || 1000` accepted a
 * negative, so a scrollHeight of -99999 was emitted straight into the exported page's
 * inline style; the bounds are sectionSchema's own.
 */
function trackHeight(s: Section): number {
  const raw = Number(s.scrollHeight);
  if (!Number.isFinite(raw) || raw <= 0) return 1000;
  return Math.min(Math.max(Math.round(raw), 100), 20_000);
}

function layoutFor(s: Section) {
  return layoutStyle(s.layout);
}

function exportableImage(src: unknown): string | null {
  const v = String(src ?? "");
  return /^https:\/\//i.test(v) || /^http:\/\//i.test(v) ? v : null;
}

function safeCss(s: unknown): string {
  // Also strip ;{} — these values are pasted mid-declaration in inline style
  // attributes, so a colour of `#fff;background-image:url(https://tracker/x.png)`
  // would append a declaration and make every visitor call out to that host,
  // bypassing the url()/expression() filtering applied to customCss.
  // Parentheses stay: legitimate values like rgba(255,255,255,0.7) need them, and
  // without a semicolon or brace the value cannot escape its own declaration.
  return String(s ?? "").replace(/[<>"'\\;{}]/g, "");
}

/**
 * The CTA target, allowing what ctaHrefSchema allows and nothing else.
 *
 * An allowlist, so javascript:, data: and anything unlisted become "#". `//host` is
 * excluded as well: it satisfies the schema's leading slash but leaves the origin.
 */
/** The body, or null once it exceeds `limit` — at which point reading stops. */
async function readCapped(req: NextRequest, limit: number): Promise<string | null> {
  const body = req.body;
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  let seen = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      seen += value.byteLength;
      if (seen > limit) return null;
      out += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  return out + decoder.decode();
}

function safeHref(s: unknown): string {
  const href = String(s ?? "").trim();
  if (href.startsWith("//")) return "#";
  return /^(?:https?:\/\/|mailto:|tel:|#|\/|\.{1,2}\/)/i.test(href) ? href : "#";
}

export async function POST(req: NextRequest) {
  // No accounts and no database, so the request body is the whole input and there is no
  // stored record to prefer over it. Rate limited by IP, there being no user to key on.
  const rl = await rateLimit(getClientIp(req), { bucket: "export-site", limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  try {
    // Frames are assembled client-side — only metadata is sent to the server. Every other
    // input is capped below, but the body itself was not, so a caller could still ship
    // megabytes of `sections`. Cap the raw body before parsing it.
    const MAX_BODY = 12_000_000;
    const declaredLen = Number(req.headers.get("content-length") ?? "");
    if (Number.isFinite(declaredLen) && declaredLen > MAX_BODY) {
      return NextResponse.json({ error: "Request body too large." }, { status: 413 });
    }
    // Read with a running cap rather than buffering first and measuring after. The
    // header check above is only as honest as the sender: omit Content-Length, send
    // chunked, and req.text() would hold the whole stream in memory before anyone
    // looked at its size.
    const raw = await readCapped(req, MAX_BODY);
    if (raw === null) {
      return NextResponse.json({ error: "Request body too large." }, { status: 413 });
    }
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const {
      mobileFrameCount = 0,
      hasAudio = false,
      audioMime = "audio/mpeg",
      frameCount,
    } = body;
    const {
      sections,
      siteName,
      siteDescription = "",
      styleJson = "",
      customHead = "",
      customCss = "",
      themeJson = "",
      fps = 24,
    } = body;


    if (!Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json({ error: "sections must be a non-empty array" }, { status: 400 });
    }
    // Cap the section payload: with no stored record to fall back on, the body is the
    // only input and an uncapped `sections` amplifies a small request into a huge page.
    if (JSON.stringify(sections).length > 1_000_000) {
      return NextResponse.json({ error: "sections payload is too large" }, { status: 400 });
    }
    // Shape, not just size. Without this the route read whatever arrived: a null element
    // threw inside the generator and surfaced as a 500 "Export failed", and a heading of
    // the wrong type was interpolated as-is, so `{"heading":{"a":1}}` shipped a page
    // whose <h1> read "[object Object]". Types only - out-of-range numbers stay the
    // clamps' job below, and MAX_SECTIONS is the limit the editor itself enforces.
    const parsedSections = exportSectionsSchema.safeParse(sections);
    if (!parsedSections.success) {
      const issue = parsedSections.error.issues[0];
      const where = issue?.path?.length ? issue.path.join(".") : "sections";
      return NextResponse.json(
        { error: `${where}: ${issue?.message ?? "invalid section"}` },
        { status: 400 }
      );
    }
    // Cast because this schema checks types, not the enums: an unrecognised layout or
    // reveal is clamped a few lines down rather than rejected.
    const validSections = parsedSections.data as Section[];
    // A background recipe lets the exported page draw its own frames, so the ZIP carries
    // no JPEGs at all. Frames are only required when there is no recipe to draw from.
    const parsedStyle = styleJson ? parseStyleJson(styleJson) : null;
    const styleSpec = parsedStyle?.ok ? parsedStyle.value : null;
    // How many steps the procedural background is sampled over. Not files on disk, so
    // this costs nothing but smoothness.
    const PROCEDURAL_FRAMES = 240;
    const proceduralRuntime = proceduralRuntimeSource();
    if (styleSpec) {
      if (frameCount !== undefined && frameCount !== 0 && !Number.isInteger(frameCount)) {
        return NextResponse.json({ error: "frameCount must be an integer" }, { status: 400 });
      }
    } else if (!Number.isInteger(frameCount) || frameCount < 1 || frameCount > 2000) {
      // Number.isInteger, not just "> 1": JSON.parse turns 1e999 into Infinity, which
      // passed the old check and emitted `new Array(Infinity)` into the exported script —
      // a RangeError that killed the whole IIFE, leaving a black page with no error.
      return NextResponse.json({ error: "frameCount must be an integer between 1 and 2000" }, { status: 400 });
    }

    const MAX_CSS = 50_000;
    const MAX_HEAD = 50_000;
    if (typeof customCss === "string" && customCss.length > MAX_CSS) {
      return NextResponse.json({ error: "customCss exceeds 50 KB limit" }, { status: 400 });
    }
    if (typeof customHead === "string" && customHead.length > MAX_HEAD) {
      return NextResponse.json({ error: "customHead exceeds 50 KB limit" }, { status: 400 });
    }

    // Scripts are allowed in customHead — the exported ZIP runs on the user's own domain,
    // not on scrollcraft.app, so injected scripts (e.g. GA, Hotjar) pose no XSS risk to us.
    const safeCustomHead = typeof customHead === "string" ? customHead : "";
    const parsedTheme = themeJson ? parseThemeJson(themeJson) : null;
    const compiledTheme = compileTheme(parsedTheme && parsedTheme.ok ? parsedTheme.value : null);
    // Load the webfont stylesheet without blocking first paint. A plain
    // <link rel="stylesheet"> to Google Fonts is render-blocking on a third-party
    // origin, which was holding first contentful paint at ~2.9s on a page whose own
    // markup is a few kilobytes. The media/onload swap applies it as soon as it
    // arrives, and the <noscript> copy keeps it working with scripting disabled.
    const themeFontLinks = compiledTheme.fontHref
      ? [
          `<link rel="preconnect" href="https://fonts.googleapis.com" />`,
          `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`,
          `<link rel="stylesheet" href="${compiledTheme.fontHref}" media="print" onload="this.media='all';this.onload=null" />`,
          `<noscript><link rel="stylesheet" href="${compiledTheme.fontHref}" /></noscript>`,
        ].join("\n  ")
      : "";
    const themeVarsCss = varsToCss(compiledTheme.vars);

    const safeCustomCss = typeof customCss === "string"
      ? customCss.replace(/url\s*\(\s*["']?\s*javascript:/gi, "url(#").replace(/expression\s*\(/gi, "(")
                 .replace(/<\/style/gi, "<\\/style")
      : "";

    const rawMobileCount = Math.floor(Number(mobileFrameCount) || 0);
    const validatedMobileFrameCount = Number.isFinite(rawMobileCount)
      ? Math.min(Math.max(rawMobileCount, 0), 2000)
      : 0;
    const hasMobileFrames = validatedMobileFrameCount > 0;
    // Map through an allowlist. Stripping non-alphanumerics from the raw mime turned
    // audio/x-m4a into ".xm4a", which static hosts serve as application/octet-stream
    // and browsers refuse to decode — a silent site.
    const AUDIO_EXT: Record<string, string> = {
      "audio/mpeg": "mp3", "audio/mp3": "mp3",
      "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/mp4": "m4a",
      "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav",
      "audio/ogg": "ogg", "audio/webm": "webm", "audio/aac": "aac", "audio/flac": "flac",
    };
    const baseMime = typeof audioMime === "string" ? audioMime.split(";")[0].trim().toLowerCase() : "";
    const audioExt = AUDIO_EXT[baseMime] ?? "mp3";
    const validatedFps = Math.min(Math.max(Number(fps) || 24, 1), 60);

    // Generate sections HTML (server-side for XSS safety)
    // Each section is a tall container; content is sticky so it stays pinned
    // in the viewport while the background canvas scrubs underneath.
    // The editor hides sections with visible === false in both its preview and its own
    // scroll-height total, but POSTs the unfiltered array. Exporting them shipped draft
    // copy verbatim and inflated the scroll track, desynchronizing every frame.
    // Falls back to the old behaviour (the site name) when no description is set, so an
    // export never ships an empty description tag.
    const metaDescription =
      String(siteDescription ?? "").trim().slice(0, 300) ||
      siteName ||
      "A cinematic scroll website";

    // The validated copy, not the raw body: unknown keys are stripped and every field
    // is the type the generator below assumes.
    const visibleSections = onlyVisible(validSections);
    if (visibleSections.length === 0) {
      return NextResponse.json({ error: "At least one section must be visible to export" }, { status: 400 });
    }

    // The first heading on the page is the page's heading. Every section emitted an h2,
    // so an exported site had no h1 at all — a document outline starting at level two,
    // which assistive technology and search engines both read as a missing title.
    const firstHeadingIndex = visibleSections.findIndex((s: Section) => s.heading);

    const sectionsHtml = visibleSections.map((s: Section, sectionIndex: number) => {
      const L = layoutFor(s);
      const stack = L.textAlign === "center" ? "0 auto 1.5rem" : "0 0 1.5rem";
      const imgSrc = exportableImage(s.image);
      const imgWidth = Math.min(Number(s.imageWidth) || 480, 1600);
      if (s.kind === "spacer") {
        return `
    <section class="scroll-section" aria-hidden="true" style="height:${trackHeight(s)}px; position:relative; z-index:10;"></section>`;
      }
      const reveal = (REVEALS as readonly string[]).includes(s.reveal ?? "") ? s.reveal : "rise";
      const hTag = sectionIndex === firstHeadingIndex ? "h1" : "h2";
      const scrim = Math.min(Math.max(Number(s.scrim ?? 0) || 0, 0), 1);
      return `
    <section class="scroll-section" style="height:${trackHeight(s)}px; position:relative; z-index:10;">
      <div class="section-sticky" style="position:sticky; top:0; height:100vh; display:flex; align-items:${safeCss(s.align || L.align)}; justify-content:${safeCss(s.justify || L.justify)}; overflow:hidden;">
        <div class="section-content" data-reveal="${reveal}" style="${scrim > 0 ? `background:radial-gradient(ellipse 120% 100% at 50% 50%, rgba(0,0,0,${scrim}) 0%, rgba(0,0,0,${(scrim * 0.72).toFixed(3)}) 45%, rgba(0,0,0,0) 78%); ` : ""}text-align:${safeCss(s.textAlign || L.textAlign)}; padding:${L.pad}; max-width:${L.maxWidth}px; transition:opacity 0.6s cubic-bezier(0.25,0.46,0.45,0.94),transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94),clip-path 0.7s cubic-bezier(0.25,0.46,0.45,0.94);">
          ${imgSrc ? `<img src="${esc(imgSrc)}" alt="${esc(s.imageAlt || "")}" style="display:block; max-width:min(100%, ${imgWidth}px); height:auto; margin:${stack};" />` : ""}
          ${s.eyebrow ? `<p class="eyebrow" style="font-size:0.875rem; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:${safeCss(s.accentColor || "var(--sc-accent-text, #ede9fe)")}; margin-bottom:0.75rem;">${esc(s.eyebrow)}</p>` : ""}
          ${s.heading ? (s.kind === "statement"
            ? `<${hTag} class="sc-display sc-statement" style="color:${safeCss(s.headingColor || "var(--sc-ink, #ffffff)")}; margin-bottom:1rem;">${esc(s.heading)}</${hTag}>`
            : `<${hTag} class="sc-display" style="font-size:var(--sc-heading-size, clamp(2rem,5vw,4rem)); font-weight:var(--sc-display-weight, 900); line-height:1; letter-spacing:var(--sc-display-tracking, -0.03em); text-transform:var(--sc-display-case, none); color:${safeCss(s.headingColor || "var(--sc-ink, #ffffff)")}; margin-bottom:1rem;">${esc(s.heading)}</${hTag}>`) : ""}
          ${s.body ? `<p style="font-size:var(--sc-body-size, 1.125rem); line-height:1.7; color:${safeCss(s.bodyColor || "var(--sc-muted, rgba(255,255,255,0.72))")}; max-width:var(--sc-measure, 600px); margin:${stack};">${esc(s.body)}</p>` : ""}
          ${s.ctaLabel ? `<a href="${esc(safeHref(s.ctaHref || "#"))}" style="display:inline-block; background:${safeCss(s.accentColor || "var(--sc-accent, #7c3aed)")}; color:white; padding:0.875rem 2rem; border-radius:var(--sc-radius, 8px); font-weight:600; text-decoration:none; font-size:1rem;">${esc(s.ctaLabel)}</a>` : ""}
        </div>
      </div>
    </section>`;
    }).join("\n");

    const totalScrollHeight = visibleSections.reduce((acc: number, s: Section) => acc + trackHeight(s), 0) + 1000;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  ${themeFontLinks}
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(siteName || "My ScrollCraft Site")}</title>
  <meta name="description" content="${esc(metaDescription)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(siteName || "My ScrollCraft Site")}" />
  <meta property="og:description" content="${esc(metaDescription)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta property="og:image" content="og-image.png" />
  <meta name="twitter:image" content="og-image.png" />
  <meta name="theme-color" content="${esc(compiledTheme.vars["--sc-ground"] ?? "#000000")}" />
  <link rel="icon" href="favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="og-image.png" />
  <style>
    ${themeVarsCss}
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: auto; }
    body { background: var(--sc-ground, #000); color: var(--sc-ink, #fff); font-family: var(--sc-font-body, system-ui, sans-serif); overflow-x: hidden; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    /* Off-screen until focused, so a keyboard user can jump the background canvas. */
    .skip-link { position: absolute; left: -9999px; top: 0; z-index: 100; padding: 0.75rem 1.25rem; background: var(--sc-ink, #fff); color: var(--sc-ground, #000); border-radius: 0 0 0.5rem 0; font-weight: 600; text-decoration: none; }
    .skip-link:focus { left: 0; }
    main:focus { outline: none; }
    /* The page sets its own colours, so the browser default ring can vanish against them. */
    a:focus-visible, button:focus-visible, [tabindex]:focus-visible { outline: 3px solid var(--sc-accent-text, #ede9fe); outline-offset: 3px; border-radius: 2px; }
    #scroll-canvas { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
    #scroll-container { position: relative; height: ${totalScrollHeight}px; z-index: 1; pointer-events: none; }
    .scroll-section { pointer-events: none; }
    .section-sticky { pointer-events: none; }
    .section-content { pointer-events: auto; }
    .section-content.visible { opacity: 1 !important; transform: translateY(0) !important; }
    .section-content[data-reveal] { opacity: 0; }
    .section-content[data-reveal="rise"] { transform: translateY(32px); }
    .section-content[data-reveal="fade"] { transform: none; }
    .section-content[data-reveal="scale"] { transform: scale(0.94); }
    .section-content[data-reveal="mask"] { clip-path: inset(0 0 100% 0); transform: none; }
    .section-content[data-reveal="none"] { opacity: 1; transform: none; }
    .section-content[data-reveal].visible { opacity: 1 !important; transform: none !important; clip-path: inset(0 0 0 0); }
    .section-content[data-reveal="stagger"] > * { opacity: 0; transform: translateY(22px); transition: opacity 0.55s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94); }
    .section-content[data-reveal="stagger"].visible > * { opacity: 1; transform: none; }
    .section-content[data-reveal="stagger"].visible > *:nth-child(2) { transition-delay: 90ms; }
    .section-content[data-reveal="stagger"].visible > *:nth-child(3) { transition-delay: 180ms; }
    .section-content[data-reveal="stagger"].visible > *:nth-child(n+4) { transition-delay: 270ms; }
    .sc-display { font-family: var(--sc-font-display, var(--sc-font-body, system-ui, sans-serif)); }
    .sc-statement { font-size: clamp(2.75rem, 11vw, 9rem); font-weight: var(--sc-display-weight, 800); line-height: 0.92; letter-spacing: var(--sc-display-tracking, -0.045em); text-transform: var(--sc-display-case, none); margin: 0; }
    @media (prefers-reduced-motion: reduce) {
      .section-content[data-reveal], .section-content[data-reveal="stagger"] > * {
        opacity: 1 !important; transform: none !important; clip-path: none !important; transition: none !important;
      }
    }
    #scroll-hint {
      position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
      pointer-events: none;
      display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
      color: rgba(255,255,255,0.4); font-size: 0.75rem; letter-spacing: 0.1em;
      text-transform: uppercase; z-index: 20; transition: opacity 0.5s;
    }
    #scroll-hint .arrow { width: 1px; height: 40px; background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.4)); }
    #audio-mute {
      position: fixed; top: 1rem; right: 1rem; z-index: 30;
      background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15);
      color: white; border-radius: 50%; width: 2rem; height: 2rem;
      cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }
    #audio-mute:hover { background: rgba(255,255,255,0.1); }
  </style>
  ${safeCustomCss ? `<style>\n${safeCustomCss}\n  </style>` : ""}
  <noscript><style>
    .section-content[data-reveal] { opacity: 1 !important; transform: none !important; clip-path: none !important; }
    .section-content[data-reveal="stagger"] > * { opacity: 1 !important; transform: none !important; }
    .section-sticky { position: static !important; height: auto !important; }
    #scroll-container { height: auto !important; }
    #scroll-hint, #scroll-canvas { display: none !important; }
  </style></noscript>
  ${safeCustomHead || ""}
  <script src="lenis.min.js"></script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <canvas id="scroll-canvas" role="img" aria-label="${esc(siteName ? `${siteName} animated scroll background` : "Animated scroll background")}"></canvas>
  <main id="main" tabindex="-1">
    <div id="scroll-container">
      <div style="height:100vh;"></div>
      ${sectionsHtml}
    </div>
  </main>
  <div id="scroll-hint">
    <span>Scroll</span>
    <div class="arrow"></div>
  </div>
  ${hasAudio ? `<button id="audio-mute" title="Toggle audio">🔊</button>` : ""}

  <script>
    (function() {
      const canvas = document.getElementById('scroll-canvas');
      const ctx = canvas.getContext('2d');
      const desktopCount = ${styleSpec ? PROCEDURAL_FRAMES : frameCount};
      const mobileCount = ${styleSpec ? 0 : validatedMobileFrameCount};
      const hasMobile = ${styleSpec ? "false" : hasMobileFrames ? "true" : "false"};
      const totalScrollHeight = ${totalScrollHeight};

      let isMobile = hasMobile && window.matchMedia('(max-width: 767px)').matches;
      let frameCount = isMobile ? mobileCount : desktopCount;
      const desktopImages = new Array(desktopCount);
      const mobileImages = hasMobile ? new Array(mobileCount) : null;
      let currentFrame = 0;

      function getImages() { return (isMobile && mobileImages) ? mobileImages : desktopImages; }

      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Recomputed inside resize() as well — captured once, zooming or dragging the
      // window to a non-Retina display rebuilt the backing store at the stale ratio.

      function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        var cssW = window.innerWidth, cssH = window.innerHeight;
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
        canvas.style.width = cssW + 'px';
        canvas.style.height = cssH + 'px';
        ctx.scale(dpr, dpr);
        drawFrame(currentFrame);
      }

      ${styleSpec ? `
      // Procedural background: the ZIP ships no frames at all, the page draws each one
      // on demand at the viewport's own resolution.
      ${proceduralRuntime.source}

      // drawFrame2D takes FrameOptions (color1/color2/color3) while a stored style
      // recipe holds a colours array. Emitting the recipe verbatim left every colour
      // undefined, so hexToRgb threw on the first frame and the exported page rendered a
      // black screen with a console error.
      var recipe = ${JSON.stringify({
        style: styleSpec?.style,
        color1: styleSpec?.colors[0],
        color2: styleSpec?.colors[1],
        color3: styleSpec?.colors[2],
        frameCount: PROCEDURAL_FRAMES,
      })};
      function drawFrame(index) {
        var cssW = window.innerWidth, cssH = window.innerHeight;
        var p = frameCount > 1 ? index / (frameCount - 1) : 0;
        ${proceduralRuntime.entry}(ctx, cssW, cssH, p, recipe);
      }
      ` : `
      function drawFrame(index) {
        var images = getImages();
        var img = images[index];
        if (!img || !img.complete) return;
        if (!img.naturalWidth || !img.naturalHeight) return;
        var cssW = window.innerWidth, cssH = window.innerHeight;
        var scale = Math.max(cssW / img.naturalWidth, cssH / img.naturalHeight);
        var w = img.naturalWidth * scale, h = img.naturalHeight * scale;
        ctx.clearRect(0, 0, cssW, cssH);
        ctx.drawImage(img, (cssW - w) / 2, (cssH - h) / 2, w, h);
      }
      `}

      ${styleSpec ? "" : `
      function preloadSet(count, folder, target, isPrimary) {
        var STEP = 5;
        var keyframes = [];
        for (var i = 0; i < count; i += STEP) keyframes.push(i);
        var settled = 0; // counts successes + failures so the chain never hangs

        function loadFrame(idx) {
          var img = new Image();
          img.decoding = 'async';
          img.src = folder + '/frame_' + String(idx).padStart(4, '0') + '.jpg';
          img.onload = function() {
            var put = function() {
              target[idx] = img;
              if ((idx === 0 && isPrimary) || idx === currentFrame) drawFrame(idx);
            };
            // Decode off the scroll path so drawImage never pays a synchronous decode.
            if (img.decode) { img.decode().then(put).catch(put); } else { put(); }
          };
          // onerror intentionally left empty — slot stays undefined, drawFrame skips it
        }

        keyframes.forEach(function(i) {
          var img = new Image();
          img.src = folder + '/frame_' + String(i).padStart(4, '0') + '.jpg';
          function advance() {
            settled++;
            if (settled === keyframes.length) {
              for (var j = 0; j < count; j++) {
                if (j % STEP !== 0) loadFrame(j);
              }
            }
          }
          img.decoding = 'async';
          img.onload = function() {
            var put = function() {
              target[i] = img;
              if (i === 0 && isPrimary) drawFrame(0);
              if (i === currentFrame) drawFrame(i);
            };
            if (img.decode) { img.decode().then(put).catch(put); } else { put(); }
            advance();
          };
          img.onerror = advance; // count failure so we don't hang
        });
      }

      // Load only the set actually being drawn. Fetching both meant a phone on
      // cellular downloaded the desktop frames too — for a 240+240 frame export at
      // ~150 KB each that is ~70 MB, half of it never rendered.
      var mobileLoaded = false, desktopLoaded = false;
      function preload() {
        if (hasMobile && isMobile) { preloadSet(mobileCount, 'frames-mobile', mobileImages, true); mobileLoaded = true; }
        else { preloadSet(desktopCount, 'frames', desktopImages, true); desktopLoaded = true; }
      }

      if (hasMobile) {
        var mq = window.matchMedia('(max-width: 767px)');
        mq.addEventListener('change', function(e) {
          isMobile = e.matches;
          frameCount = isMobile ? mobileCount : desktopCount;
          if (isMobile && !mobileLoaded) { preloadSet(mobileCount, 'frames-mobile', mobileImages, true); mobileLoaded = true; }
          if (!isMobile && !desktopLoaded) { preloadSet(desktopCount, 'frames', desktopImages, true); desktopLoaded = true; }
          // Recompute from the current scroll position instead of snapping to frame 0 —
          // rotating a phone mid-page used to jump the background back to the start.
          onScroll();
        });
      }
      `}

      var rafId;
      function onScroll() {
        var scrollTop = window.scrollY;
        // Measure the real scrollable distance. totalScrollHeight - innerHeight ignored
        // the 100vh spacer inside the container, so on any viewport taller than 1000px
        // the animation finished early — and with one short section the denominator went
        // negative and the canvas never left frame 0.
        var maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
        var progress = Math.min(Math.max(scrollTop / maxScroll, 0), 1);
        var frameIndex = Math.min(Math.floor(progress * (frameCount - 1)), frameCount - 1);
        if (frameIndex !== currentFrame) {
          currentFrame = frameIndex;
          cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(function() { drawFrame(frameIndex); });
        }
        var hint = document.getElementById('scroll-hint');
        if (hint) hint.style.opacity = scrollTop > 100 ? '0' : '1';
      }

      if (typeof window.Lenis !== 'undefined') {
        var lenis = new window.Lenis({ lerp: 0.08, smoothWheel: true });
        lenis.on('scroll', onScroll);
        function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
        requestAnimationFrame(raf);
      } else {
        window.addEventListener('scroll', onScroll, { passive: true });
      }
      window.addEventListener('resize', resize);
      resize();
      ${styleSpec ? "" : "preload();"}
      // Browsers restore scroll position on refresh without firing a scroll event, so
      // without this the opening frame sat behind whatever section the visitor was on.
      onScroll();
    })();

    ${hasAudio ? `
    (function() {
      var audio = new Audio('audio/track.${audioExt}');
      audio.loop = true;
      var lastScrollY = 0, lastScrollTime = 0, idleTimer = null, fadeRaf = null;

      // iOS Safari ignores writes to HTMLMediaElement.volume — it is fixed at 1 — so the
      // velocity ramp and the idle fade were silent no-ops there and the track played at
      // full volume from the first scroll. Route gain through WebAudio where available.
      var AC = window.AudioContext || window.webkitAudioContext;
      var ctx = null, gain = null;
      if (AC) {
        try {
          ctx = new AC();
          gain = ctx.createGain();
          ctx.createMediaElementSource(audio).connect(gain);
          gain.connect(ctx.destination);
        } catch (e) { ctx = null; gain = null; }
      }
      function setVol(v) {
        if (gain) { gain.gain.value = v; } else { audio.volume = v; }
      }
      function getVol() {
        return gain ? gain.gain.value : audio.volume;
      }
      setVol(0);

      function fadeVolume(target, duration) {
        var start = getVol(), startTime = performance.now();
        cancelAnimationFrame(fadeRaf);
        function tick(now) {
          var t = Math.min((now - startTime) / duration, 1);
          setVol(start + (target - start) * t);
          if (t < 1) { fadeRaf = requestAnimationFrame(tick); }
          else if (target === 0) { audio.pause(); }
        }
        fadeRaf = requestAnimationFrame(tick);
      }

      // Scrolling is not a user-activation gesture, so the play() attempted from the
      // scroll handler below always rejected with NotAllowedError and was swallowed —
      // exported audio never played at all. A click is a gesture, so start playback
      // here; the first real gesture on the page also unblocks it.
      var started = false;
      function startAudio() {
        if (started) return;
        started = true;
        audio.play().catch(function() { started = false; });
      }

      var muteBtn = document.getElementById('audio-mute');
      if (muteBtn) muteBtn.addEventListener('click', function() {
        audio.muted = !audio.muted;
        if (!audio.muted) startAudio();
        muteBtn.textContent = audio.muted ? '🔇' : '🔊';
      });

      // Any first interaction counts as activation; harmless if autoplay is allowed.
      ['pointerdown', 'keydown', 'touchstart'].forEach(function(evt) {
        window.addEventListener(evt, startAudio, { once: true, passive: true });
      });

      window.addEventListener('scroll', function() {
        var now = performance.now();
        var scrollY = window.scrollY;
        var dt = now - lastScrollTime;
        var velocity = dt > 0 ? Math.abs(scrollY - lastScrollY) / dt : 0;
        lastScrollY = scrollY; lastScrollTime = now;
        var targetVol = Math.min(Math.max(velocity / 0.5, 0.08), 1);
        if (audio.paused) {
          setVol(targetVol);
          // A context created before a gesture starts suspended; resume on first scroll.
          if (ctx && ctx.state === 'suspended') { ctx.resume(); }
          audio.play().catch(function(){});
        }
        else { cancelAnimationFrame(fadeRaf); setVol(targetVol); }
        clearTimeout(idleTimer);
        idleTimer = setTimeout(function() { fadeVolume(0, 600); }, 2000);
      }, { passive: true });
    })();
    ` : ""}
    (function() {
      // Observe the section-content divs (inside sticky wrappers) for entrance animations.
      const contents = document.querySelectorAll('.section-content');
      // Add only, and the same rootMargin SiteRenderer uses, so a section reveals once
      // here as it does in the preview rather than replaying on every pass.
      const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });
      contents.forEach(function(el) { observer.observe(el); });
    })();
  </script>
</body>
</html>`;

    return NextResponse.json({
      html,
      audioExt,
      siteName: siteName || "scrollcraft-site",
      fps: validatedFps,
    });
  } catch (err) {
    logger.error("export-site failed", { err });
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
