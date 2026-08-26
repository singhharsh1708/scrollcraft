import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // Unvalidated params reached the SVG as NaN ("hsl(NaN,65%,15%)", cx="NaN"), producing an
  // unrenderable image that was then cached for an hour.
  const clamp = (raw: string | null, fallback: number, min: number, max: number) => {
    // Number(null) and Number("") are both 0, which is finite — so without this guard an
    // absent or empty param silently became 0 instead of taking the documented fallback.
    if (raw === null || raw.trim() === "") return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), min), max) : fallback;
  };
  const total = clamp(searchParams.get("total"), 120, 1, 1000);
  const i = clamp(searchParams.get("i"), 0, 0, total);
  const p = i / Math.max(total - 1, 1);

  const hue  = Math.floor(p * 280 + 220) % 360;
  const hue2 = (hue + 40) % 360;
  const hue3 = (hue + 120) % 360;

  const ox1 = Math.round(640 + Math.sin(p * Math.PI * 4) * 220);
  const oy1 = Math.round(360 + Math.cos(p * Math.PI * 2) * 110);
  const r1  = Math.round(90 + p * 50);

  const ox2 = Math.round(400 + Math.cos(p * Math.PI * 3) * 160);
  const oy2 = Math.round(200 + Math.sin(p * Math.PI * 5) * 90);
  const r2  = Math.round(50 + p * 30);

  const ox3 = Math.round(900 + Math.sin(p * Math.PI * 2.5 + 1) * 180);
  const oy3 = Math.round(500 + Math.cos(p * Math.PI * 3.5) * 100);
  const r3  = Math.round(60 + p * 25);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%">
      <stop offset="0%" stop-color="hsl(${hue},65%,15%)"/>
      <stop offset="60%" stop-color="hsl(${hue + 20},70%,7%)"/>
      <stop offset="100%" stop-color="hsl(${hue + 10},60%,3%)"/>
    </radialGradient>
    <radialGradient id="o1" cx="50%" cy="50%">
      <stop offset="0%" stop-color="hsl(${hue2},90%,65%)" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="hsl(${hue2},90%,65%)" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="o2" cx="50%" cy="50%">
      <stop offset="0%" stop-color="hsl(${hue3},85%,70%)" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="hsl(${hue3},85%,70%)" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="o3" cx="50%" cy="50%">
      <stop offset="0%" stop-color="hsl(${hue},80%,60%)" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="hsl(${hue},80%,60%)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <ellipse cx="${ox1}" cy="${oy1}" rx="${r1 * 2}" ry="${r1 * 2}" fill="url(#o1)"/>
  <ellipse cx="${ox2}" cy="${oy2}" rx="${r2 * 2}" ry="${r2 * 2}" fill="url(#o2)"/>
  <ellipse cx="${ox3}" cy="${oy3}" rx="${r3 * 2}" ry="${r3 * 2}" fill="url(#o3)"/>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      // Output depends only on (i, total), so let the CDN absorb the 60-120 requests a
      // single page view fans out — max-age alone left every cold visitor hitting the origin.
      "Cache-Control": "public, max-age=3600, s-maxage=86400, immutable",
    },
  });
}
