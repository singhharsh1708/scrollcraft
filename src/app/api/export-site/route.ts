import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

function safeCss(s: string): string {
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

  const rl = await rateLimit(getClientIp(req), { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  try {
    // Frames are assembled client-side — only metadata is sent to the server.
    const body = await req.json();
    const {
      sections,
      siteName,
      customHead = "",
      customCss = "",
      siteId,
      fps = 24,
      frameCount,
      mobileFrameCount = 0,
      hasAudio = false,
      audioMime = "audio/mpeg",
    } = body;

    // FREE users must purchase an export; paid subscribers export freely
    const userPlan = session.user.plan ?? "FREE";
    if (userPlan === "FREE") {
      if (!siteId) {
        return NextResponse.json(
          { error: "Save your site before exporting.", code: "SAVE_REQUIRED" },
          { status: 402 }
        );
      }
      const purchase = await db.exportPurchase.findFirst({
        where: { siteId, userId: session.user.id, status: "PAID" },
      });
      if (!purchase) {
        return NextResponse.json(
          { error: "Export purchase required", code: "PURCHASE_REQUIRED" },
          { status: 402 }
        );
      }
    }

    if (!Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json({ error: "sections must be a non-empty array" }, { status: 400 });
    }
    if (typeof frameCount !== "number" || frameCount < 1) {
      return NextResponse.json({ error: "frameCount must be a positive number" }, { status: 400 });
    }

    const MAX_CSS = 50_000;
    const MAX_HEAD = 50_000;
    if (typeof customCss === "string" && customCss.length > MAX_CSS) {
      return NextResponse.json({ error: "customCss exceeds 50 KB limit" }, { status: 400 });
    }
    if (typeof customHead === "string" && customHead.length > MAX_HEAD) {
      return NextResponse.json({ error: "customHead exceeds 50 KB limit" }, { status: 400 });
    }

    const safeCustomHead = typeof customHead === "string"
      ? customHead.replace(/<script[\s\S]*?<\/script>/gi, "")
      : "";
    const safeCustomCss = typeof customCss === "string"
      ? customCss.replace(/url\s*\(\s*["']?\s*javascript:/gi, "url(#").replace(/expression\s*\(/gi, "(")
      : "";

    const hasMobileFrames = mobileFrameCount > 0;
    const audioExt = audioMime.split("/")[1]?.split(";")[0] ?? "mp3";
    const validatedFps = Math.min(Math.max(Number(fps) || 24, 1), 60);

    // Generate sections HTML (server-side for XSS safety)
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
  ${safeCustomCss ? `<style>\n${safeCustomCss}\n  </style>` : ""}
  ${safeCustomHead || ""}
  <script src="https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js"></script>
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
      const desktopCount = ${frameCount};
      const mobileCount = ${mobileFrameCount};
      const hasMobile = ${hasMobileFrames ? "true" : "false"};
      const totalScrollHeight = ${totalScrollHeight};

      let isMobile = hasMobile && window.matchMedia('(max-width: 767px)').matches;
      let frameCount = isMobile ? mobileCount : desktopCount;
      const desktopImages = new Array(desktopCount);
      const mobileImages = hasMobile ? new Array(mobileCount) : null;
      let currentFrame = 0;

      function getImages() { return (isMobile && mobileImages) ? mobileImages : desktopImages; }

      var dpr = Math.min(window.devicePixelRatio || 1, 2);

      function resize() {
        var cssW = window.innerWidth, cssH = window.innerHeight;
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
        canvas.style.width = cssW + 'px';
        canvas.style.height = cssH + 'px';
        ctx.scale(dpr, dpr);
        drawFrame(currentFrame);
      }

      function drawFrame(index) {
        var images = getImages();
        var img = images[index];
        if (!img || !img.complete) return;
        var cssW = window.innerWidth, cssH = window.innerHeight;
        var scale = Math.max(cssW / img.naturalWidth, cssH / img.naturalHeight);
        var w = img.naturalWidth * scale, h = img.naturalHeight * scale;
        ctx.clearRect(0, 0, cssW, cssH);
        ctx.drawImage(img, (cssW - w) / 2, (cssH - h) / 2, w, h);
      }

      function preloadSet(count, folder, target, isPrimary) {
        var STEP = 5;
        var keyframes = [];
        for (var i = 0; i < count; i += STEP) keyframes.push(i);
        var loaded = 0;

        function loadFrame(idx) {
          var img = new Image();
          img.src = folder + '/frame_' + String(idx).padStart(4, '0') + '.jpg';
          img.onload = function() {
            target[idx] = img;
            if ((idx === 0 && isPrimary) || idx === currentFrame) drawFrame(idx);
          };
        }

        keyframes.forEach(function(i) {
          var img = new Image();
          img.src = folder + '/frame_' + String(i).padStart(4, '0') + '.jpg';
          img.onload = function() {
            target[i] = img;
            loaded++;
            if (i === 0 && isPrimary) drawFrame(0);
            if (i === currentFrame) drawFrame(i);
            if (loaded === keyframes.length) {
              for (var j = 0; j < count; j++) {
                if (j % STEP !== 0) loadFrame(j);
              }
            }
          };
        });
      }

      function preload() {
        preloadSet(desktopCount, 'frames', desktopImages, !isMobile);
        if (hasMobile) preloadSet(mobileCount, 'frames-mobile', mobileImages, isMobile);
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
      preload();
    })();

    ${hasAudio ? `
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

    return NextResponse.json({
      html,
      audioExt,
      siteName: siteName || "scrollcraft-site",
      fps: validatedFps,
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
