import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const i = parseInt(searchParams.get("i") || "0");
  const total = parseInt(searchParams.get("total") || "100");
  const progress = i / total;
  const hue = Math.floor(progress * 280 + 240);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
  <defs>
    <radialGradient id="g" cx="50%" cy="50%">
      <stop offset="0%" stop-color="hsl(${hue},70%,20%)"/>
      <stop offset="100%" stop-color="hsl(${hue + 30},80%,5%)"/>
    </radialGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#g)"/>
  <circle cx="${640 + Math.sin(progress * Math.PI * 4) * 200}" cy="${360 + Math.cos(progress * Math.PI * 2) * 100}" r="${80 + progress * 40}" fill="hsl(${hue + 60},90%,60%)" opacity="0.2"/>
  <circle cx="${400 + Math.cos(progress * Math.PI * 3) * 150}" cy="${200 + Math.sin(progress * Math.PI * 5) * 80}" r="${40 + progress * 20}" fill="hsl(${hue + 120},80%,70%)" opacity="0.15"/>
</svg>`;

  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" },
  });
}
