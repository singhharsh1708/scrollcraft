import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";

// Delete a site's hosted frame blobs. Best-effort: a blob that is already gone, or a
// storage hiccup, must not fail the site delete the user already succeeded at.
async function deleteSiteBlobs(framesJson: string | null) {
  if (!framesJson) return;
  let urls: unknown;
  try {
    urls = JSON.parse(framesJson);
  } catch {
    return;
  }
  if (!Array.isArray(urls)) return;
  const blobUrls = urls.filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//i.test(u)
  );
  if (!blobUrls.length) return;
  try {
    await del(blobUrls);
  } catch (err) {
    logger.error("failed to reclaim frame blobs on site delete", { err });
  }
}

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

  // Only real money movement blocks the delete: a PAID or REFUNDED export is a record a
  // refund or chargeback reconciles against. A PENDING or FAILED row is an abandoned or
  // failed checkout — no money changed hands, and the Restrict FK would otherwise wedge
  // the delete forever, so clear those first.
  const blocking = await db.exportPurchase.count({
    where: { siteId: id, status: { in: ["PAID", "REFUNDED"] } },
  });
  if (blocking > 0) {
    return NextResponse.json(
      { error: "This site has a purchased export and can't be deleted.", code: "HAS_PURCHASE" },
      { status: 409 }
    );
  }
  await db.exportPurchase.deleteMany({
    where: { siteId: id, status: { in: ["PENDING", "FAILED"] } },
  });

  try {
    await db.site.delete({ where: { id } });
  } catch {
    // Covers the race where a PAID purchase lands between the count above and the delete.
    return NextResponse.json({ error: "Couldn't delete this site." }, { status: 409 });
  }

  // Reclaim the site's hosted frames — nothing else references them once the row is gone.
  await deleteSiteBlobs(existing.framesJson);

  return NextResponse.json({ success: true });
}
