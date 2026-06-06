import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

export async function POST(req: NextRequest) {
  try {
    const { frames, sections, siteName, fps } = await req.json();

    const zip = new JSZip();
    const framesFolder = zip.folder("frames")!;

    // Add each frame
    for (let i = 0; i < frames.length; i++) {
      const base64 = frames[i].replace(/^data:image\/jpeg;base64,/, "");
      framesFolder.file(`frame_${String(i).padStart(4, "0")}.jpg`, base64, { base64: true });
    }

    // Generate sections HTML
    const sectionsHtml = (sections as Section[]).map((s: Section) => `
    <section class="scroll-section" style="height:${s.scrollHeight}px; position:relative; z-index:10; display:flex; align-items:${s.align || "center"}; justify-content:${s.justify || "center"};">
      <div class="section-content" style="text-align:${s.textAlign || "center"}; padding:2rem; max-width:800px;">
        ${s.eyebrow ? `<p class="eyebrow" style="font-size:0.875rem; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:${s.accentColor || "#a78bfa"}; margin-bottom:0.75rem;">${s.eyebrow}</p>` : ""}
        ${s.heading ? `<h2 style="font-size:clamp(2rem,5vw,4rem); font-weight:900; line-height:1; letter-spacing:-0.03em; color:${s.headingColor || "#ffffff"}; margin-bottom:1rem;">${s.heading}</h2>` : ""}
        ${s.body ? `<p style="font-size:1.125rem; line-height:1.7; color:${s.bodyColor || "rgba(255,255,255,0.7)"}; max-width:600px; margin:0 auto 1.5rem;">${s.body}</p>` : ""}
        ${s.ctaLabel ? `<a href="${s.ctaHref || "#"}" style="display:inline-block; background:${s.accentColor || "#7c3aed"}; color:white; padding:0.875rem 2rem; border-radius:0.5rem; font-weight:600; text-decoration:none; font-size:1rem;">${s.ctaLabel}</a>` : ""}
      </div>
    </section>`).join("\n");

    const totalScrollHeight = (sections as Section[]).reduce((acc: number, s: Section) => acc + (s.scrollHeight || 1000), 0) + 1000;

    // Build standalone HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${siteName || "My ScrollCraft Site"}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: auto; }
    body { background: #000; color: #fff; font-family: system-ui, sans-serif; overflow-x: hidden; }
    #scroll-canvas { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
    #scroll-container { position: relative; height: ${totalScrollHeight}px; z-index: 1; pointer-events: none; }
    .scroll-section { pointer-events: auto; }
    .section-content { pointer-events: auto; }
    #scroll-hint {
      position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
      display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
      color: rgba(255,255,255,0.4); font-size: 0.75rem; letter-spacing: 0.1em;
      text-transform: uppercase; z-index: 20; transition: opacity 0.5s;
    }
    #scroll-hint .arrow { width: 1px; height: 40px; background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.4)); }
  </style>
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

  <script>
    (function() {
      const canvas = document.getElementById('scroll-canvas');
      const ctx = canvas.getContext('2d');
      const frameCount = ${frames.length};
      const images = new Array(frameCount);
      let loaded = 0;
      let currentFrame = 0;
      const totalScrollHeight = ${totalScrollHeight};

      function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        drawFrame(currentFrame);
      }

      function drawFrame(index) {
        const img = images[index];
        if (!img || !img.complete) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      function preload() {
        for (let i = 0; i < frameCount; i++) {
          const img = new Image();
          img.src = 'frames/frame_' + String(i).padStart(4, '0') + '.jpg';
          img.onload = function() {
            loaded++;
            if (loaded === 1) drawFrame(0);
          };
          images[i] = img;
        }
      }

      let rafId;
      function onScroll() {
        const scrollTop = window.scrollY;
        const maxScroll = totalScrollHeight - window.innerHeight;
        const progress = Math.min(Math.max(scrollTop / maxScroll, 0), 1);
        const frameIndex = Math.min(Math.floor(progress * (frameCount - 1)), frameCount - 1);
        if (frameIndex !== currentFrame) {
          currentFrame = frameIndex;
          cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(function() { drawFrame(frameIndex); });
        }
        const hint = document.getElementById('scroll-hint');
        if (hint) hint.style.opacity = scrollTop > 100 ? '0' : '1';
      }

      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', resize);
      resize();
      preload();
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
    return NextResponse.json({ error: String(err) }, { status: 500 });
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
