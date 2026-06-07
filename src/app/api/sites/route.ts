import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

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

  const body = await req.json();
  const { id, name, fps, frameCount, framesJson, sectionsJson, customHead, customCss, audioUrl } = body;

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
