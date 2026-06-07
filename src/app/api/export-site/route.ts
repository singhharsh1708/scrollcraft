import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { auth } from "@/auth";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

function safeCss(s: string): string {
  // Strip anything that could break out of a style attribute
  return s.replace(/[<>"'\\]/g, "");
}

function safeHref(s: string): string {
  return /^https?:\/\//i.test(s) ? s : "#";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(getClientIp(req), { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { frames, mobileFrames, audioSrc, sections, siteName, customHead = "", customCss = "" } = body;

    if (!Array.isArray(frames) || frames.length === 0) {
      return NextResponse.json({ error: "frames must be a non-empty array" }, { status: 400 });
    }
    if (!Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json({ error: "sections must be a non-empty array" }, { status: 400 });
    }

    const isBlobUrl = frames[0].startsWith("https://") || frames[0].startsWith("http://");
    const isBase64 = frames[0].startsWith("data:image/");

    if (!isBlobUrl && !isBase64) {
      return NextResponse.json(
        { error: "Cannot export demo frames. Generate real frames first using the AI or by uploading a video." },
        { status: 400 }
      );
    }

    // Helper: get raw JPEG buffer from either base64 data URI or CDN URL
    async function frameToBuffer(src: string): Promise<Buffer> {
      if (src.startsWith("data:image/")) {
        return Buffer.from(src.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, ""), "base64");
      }
      const res = await fetch(src);
      if (!res.ok) throw new Error(`Failed to fetch frame: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    }

    const hasMobileFrames = Array.isArray(mobileFrames) && mobileFrames.length > 0
      && (mobileFrames[0].startsWith("data:image/") || mobileFrames[0].startsWith("http"));

    // Validate and extract audio
    const audioDataUriMatch = typeof audioSrc === "string"
      ? audioSrc.match(/^data:(audio\/[a-zA-Z0-9+.-]+);base64,(.+)$/)
      : null;
    const hasAudio = !!audioDataUriMatch;
    const audioMime = audioDataUriMatch?.[1] ?? "";
    const audioExt = audioMime.split("/")[1]?.split(";")[0] ?? "mp3";
    const audioBase64 = audioDataUriMatch?.[2] ?? "";

    const zip = new JSZip();
    const framesFolder = zip.folder("frames")!;

    // Add desktop frames in parallel batches
    const BATCH = 10;
    for (let i = 0; i < frames.length; i += BATCH) {
      const batch = frames.slice(i, i + BATCH);
      const buffers = await Promise.all(batch.map(frameToBuffer));
      buffers.forEach((buf, j) => {
        framesFolder.file(`frame_${String(i + j).padStart(4, "0")}.jpg`, buf);
      });
    }

    // Add mobile frames if present
    if (hasMobileFrames) {
      const mobileFolder = zip.folder("frames-mobile")!;
      for (let i = 0; i < mobileFrames.length; i += BATCH) {
        const batch = mobileFrames.slice(i, i + BATCH);
        const buffers = await Promise.all(batch.map(frameToBuffer));
        buffers.forEach((buf, j) => {
          mobileFolder.file(`frame_${String(i + j).padStart(4, "0")}.jpg`, buf);
        });
      }
    }

    // Add audio file if present
    if (hasAudio) {
      zip.file(`audio/track.${audioExt}`, audioBase64, { base64: true });
    }

    // Generate sections HTML
    const sectionsHtml = (sections as Section[]).map((s: Section) => `
    <section class="scroll-section" style="height:${Number(s.scrollHeight) || 1000}px; position:relative; z-index:10; display:flex; align-items:${safeCss(s.align || "center")}; justify-content:${safeCss(s.justify || "center")};">
      <div class="section-content" style="text-align:${safeCss(s.textAlign || "center")}; padding:2rem; max-width:800px;">
        ${s.eyebrow ? `<p class="eyebrow" style="font-size:0.875rem; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:${safeCss(s.accentColor || "#a78bfa")}; margin-bottom:0.75rem;">${esc(s.eyebrow)}</p>` : ""}
        ${s.heading ? `<h2 style="font-size:clamp(2rem,5vw,4rem); font-weight:900; line-height:1; letter-spacing:-0.03em; color:${safeCss(s.headingColor || "#ffffff")}; margin-bottom:1rem;">${esc(s.heading)}</h2>` : ""}
        ${s.body ? `<p style="font-size:1.125rem; line-height:1.7; color:${safeCss(s.bodyColor || "rgba(255,255,255,0.7)")}; max-width:600px; margin:0 auto 1.5rem;">${esc(s.body)}</p>` : ""}
        ${s.ctaLabel ? `<a href="${safeHref(s.ctaHref || "#")}" style="display:inline-block; background:${safeCss(s.accentColor || "#7c3aed")}; color:white; padding:0.875rem 2rem; border-radius:0.5rem; font-weight:600; text-decoration:none; font-size:1rem;">${esc(s.ctaLabel)}</a>` : ""}
      </div>
    </section>`).join("\n");

    const totalScrollHeight = (sections as Section[]).reduce((acc: number, s: Section) => acc + (s.scrollHeight || 1000), 0) + 1000;

    // Build standalone HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(siteName || "My ScrollCraft Site")}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: auto; }
    body { background: #000; color: #fff; font-family: system-ui, sans-serif; overflow-x: hidden; }
    #scroll-canvas { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
    #scroll-container { position: relative; height: ${totalScrollHeight}px; z-index: 1; pointer-events: none; }
    .scroll-section { pointer-events: auto; opacity: 0; transform: translateY(32px); transition: opacity 0.6s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94); }
    .scroll-section.visible { opacity: 1; transform: translateY(0); }
    .section-content { pointer-events: auto; }
    #scroll-hint {
      position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
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
  ${customCss ? `<style>\n${customCss}\n  </style>` : ""}
  ${customHead || ""}
</head>
<body>
  <canvas id="scroll-canvas"></canvas>
  <div id="scroll-container">
    <div style="height:100vh;"></div>
    ${sectionsHtml}
  </div>
  <div id="scroll-hint">
    <span>Scroll</span>
    <div class="arrow"></div>
  </div>
  ${hasAudio ? `<button id="audio-mute" title="Toggle audio">🔊</button>` : ""}

  <script>
    (function() {
      const canvas = document.getElementById('scroll-canvas');
      const ctx = canvas.getContext('2d');
      const desktopCount = ${frames.length};
      const mobileCount = ${hasMobileFrames ? (mobileFrames as string[]).length : 0};
      const hasMobile = ${hasMobileFrames ? "true" : "false"};
      const totalScrollHeight = ${totalScrollHeight};

      let isMobile = hasMobile && window.matchMedia('(max-width: 767px)').matches;
      let frameCount = isMobile ? mobileCount : desktopCount;
      const desktopImages = new Array(desktopCount);
      const mobileImages = hasMobile ? new Array(mobileCount) : null;
      let currentFrame = 0;

      function getImages() { return (isMobile && mobileImages) ? mobileImages : desktopImages; }

      function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        drawFrame(currentFrame);
      }

      function drawFrame(index) {
        const images = getImages();
        const img = images[index];
        if (!img || !img.complete) return;
        const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      }

      function preloadSet(count, folder, target) {
        for (var i = 0; i < count; i++) {
          (function(idx) {
            var img = new Image();
            img.src = folder + '/frame_' + String(idx).padStart(4, '0') + '.jpg';
            img.onload = function() {
              target[idx] = img;
              if (idx === 0 && (!isMobile || target === mobileImages)) drawFrame(0);
            };
            target[idx] = img;
          })(i);
        }
      }

      function preload() {
        preloadSet(desktopCount, 'frames', desktopImages);
        if (hasMobile) preloadSet(mobileCount, 'frames-mobile', mobileImages);
      }

      if (hasMobile) {
        var mq = window.matchMedia('(max-width: 767px)');
        mq.addEventListener('change', function(e) {
          isMobile = e.matches;
          frameCount = isMobile ? mobileCount : desktopCount;
          currentFrame = 0;
          drawFrame(0);
        });
      }

      var rafId;
      function onScroll() {
        var scrollTop = window.scrollY;
        var maxScroll = totalScrollHeight - window.innerHeight;
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

      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', resize);
      resize();
      preload();
    })();

    ${hasAudio ? `
    // Scroll-linked audio
    (function() {
      var audio = new Audio('audio/track.${audioExt}');
      audio.loop = true;
      audio.volume = 0;
      var lastScrollY = 0, lastScrollTime = 0, idleTimer = null, fadeRaf = null;

      function fadeVolume(target, duration) {
        var start = audio.volume, startTime = performance.now();
        cancelAnimationFrame(fadeRaf);
        function tick(now) {
          var t = Math.min((now - startTime) / duration, 1);
          audio.volume = start + (target - start) * t;
          if (t < 1) { fadeRaf = requestAnimationFrame(tick); }
          else if (target === 0) { audio.pause(); }
        }
        fadeRaf = requestAnimationFrame(tick);
      }

      var muteBtn = document.getElementById('audio-mute');
      if (muteBtn) muteBtn.addEventListener('click', function() {
        audio.muted = !audio.muted;
        muteBtn.textContent = audio.muted ? '🔇' : '🔊';
      });

      window.addEventListener('scroll', function() {
        var now = performance.now();
        var scrollY = window.scrollY;
        var dt = now - lastScrollTime;
        var velocity = dt > 0 ? Math.abs(scrollY - lastScrollY) / dt : 0;
        lastScrollY = scrollY; lastScrollTime = now;
        var targetVol = Math.min(Math.max(velocity / 0.5, 0.08), 1);
        if (audio.paused) { audio.volume = targetVol; audio.play().catch(function(){}); }
        else { cancelAnimationFrame(fadeRaf); audio.volume = targetVol; }
        clearTimeout(idleTimer);
        idleTimer = setTimeout(function() { fadeVolume(0, 600); }, 2000);
      }, { passive: true });
    })();
    ` : ""}
    // Scroll-linked section entrance animations
    (function() {
      const sections = document.querySelectorAll('.scroll-section');
      const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) entry.target.classList.add('visible');
          else entry.target.classList.remove('visible');
        });
      }, { threshold: 0.15 });
      sections.forEach(function(s) { observer.observe(s); });
    })();
  </script>
</body>
</html>`;

    zip.file("index.html", html);

    // Add a README
    zip.file("README.txt", `ScrollCraft Export
==================
Generated by ScrollCraft (https://scrollcraft.app)

To use:
1. Extract this zip
2. Serve from a static file server (e.g. 'npx serve .')
3. Open in browser and scroll!

Note: The frames/ folder must be in the same directory as index.html.
Do NOT open index.html directly from your filesystem — use a local server.
`);

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const uint8 = new Uint8Array(zipBuffer);

    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${(siteName || "scrollcraft-site").replace(/\s+/g, "-")}.zip"`,
      },
    });
  } catch (err) {
    console.error("export-site error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

interface Section {
  scrollHeight?: number;
  align?: string;
  justify?: string;
  textAlign?: string;
  accentColor?: string;
  eyebrow?: string;
  heading?: string;
  headingColor?: string;
  body?: string;
  bodyColor?: string;
  ctaLabel?: string;
  ctaHref?: string;
}
