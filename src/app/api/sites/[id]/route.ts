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

  // ExportPurchase now restricts this delete rather than cascading, so a site someone paid
  // to export can't be removed along with the record of that payment.
  const purchases = await db.exportPurchase.count({ where: { siteId: id } });
  if (purchases > 0) {
    return NextResponse.json(
      { error: "This site has a purchased export and can't be deleted.", code: "HAS_PURCHASE" },
      { status: 409 }
    );
  }

  try {
    await db.site.delete({ where: { id } });
  } catch {
    // Covers the race where a purchase lands between the count above and the delete.
    return NextResponse.json({ error: "Couldn't delete this site." }, { status: 409 });
  }
  return NextResponse.json({ success: true });
}
