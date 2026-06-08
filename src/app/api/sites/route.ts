import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";

const siteSchema = z.object({
  id: z.string().optional(),
  name: z.string().max(255).optional(),
  fps: z.number().int().min(1).max(120).optional(),
  frameCount: z.number().int().min(0).optional(),
  framesJson: z.string().max(10_000_000).optional(),
  sectionsJson: z.string().max(1_000_000).optional(),
  customHead: z.string().max(50_000).optional(),
  customCss: z.string().max(50_000).optional(),
  audioUrl: z.string().url().max(2000).optional().or(z.literal("")),
});

// GET /api/sites — list the current user's sites
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const sites = await db.site.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, frameCount: true, fps: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ sites });
}

// POST /api/sites — create or update a site
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const raw = await req.json();
  const parsed = siteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { id, name, fps, frameCount, framesJson, sectionsJson, customHead, customCss, audioUrl } = parsed.data;

  if (id) {
    // Update existing site — verify ownership
    const existing = await db.site.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const site = await db.site.update({
      where: { id },
      data: { name, fps, frameCount, framesJson, sectionsJson, customHead, customCss, audioUrl },
    });
    return NextResponse.json({ site });
  }

  // Create new site
  const site = await db.site.create({
    data: { userId: user.id, name, fps, frameCount, framesJson, sectionsJson, customHead, customCss, audioUrl },
  });
  return NextResponse.json({ site });
}
