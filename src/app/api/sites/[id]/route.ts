import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

// GET /api/sites/[id] — load a site by ID
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const site = await db.site.findFirst({ where: { id, userId: user.id } });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  return NextResponse.json({ site });
}

// DELETE /api/sites/[id] — delete a site
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existing = await db.site.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  await db.site.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
