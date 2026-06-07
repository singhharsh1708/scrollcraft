import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const i = parseInt(searchParams.get("i") || "0");
  const total = parseInt(searchParams.get("total") || "120");
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
      "Cache-Control": "public, max-age=3600",
    },
  });
}
