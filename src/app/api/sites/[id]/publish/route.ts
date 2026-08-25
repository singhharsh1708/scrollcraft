import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { planByKey } from "@/lib/plans";
import { parseSectionsJson, parseStyleJson, visibleSections } from "@/lib/siteSchema";

const bodySchema = z.object({ action: z.enum(["publish", "unpublish"]) });

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : `site-${suffix}`;
}

function hasFrameUrls(framesJson: string | null): boolean {
  if (!framesJson) return false;
  try {
    const decoded: unknown = JSON.parse(framesJson);
    return Array.isArray(decoded) && decoded.length > 0 &&
      decoded.every((f) => typeof f === "string" && /^https?:\/\//i.test(f));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(getClientIp(req), { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, plan: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { id } = await ctx.params;
  const site = await db.site.findFirst({
    where: { id, userId: user.id },
    select: { id: true, name: true, published: true, publishSlug: true, sectionsJson: true, styleJson: true, framesJson: true },
  });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  if (parsed.data.action === "unpublish") {
    // The slug is kept so republishing restores the same URL.
    await db.site.update({ where: { id: site.id }, data: { published: false } });
    return NextResponse.json({ published: false, slug: site.publishSlug });
  }

  const sections = parseSectionsJson(site.sectionsJson ?? "[]");
  if (!sections.ok || visibleSections(sections.sections).length === 0) {
    return NextResponse.json(
      { error: "Save the site with at least one visible section before publishing." },
      { status: 400 }
    );
  }
  const style = site.styleJson ? parseStyleJson(site.styleJson) : null;
  if (!style?.ok && !hasFrameUrls(site.framesJson)) {
    return NextResponse.json(
      {
        error: "This site predates hosted publishing and its background can't be rebuilt. Recreate it from a template or the create flow to publish.",
        code: "NO_BACKGROUND",
      },
      { status: 400 }
    );
  }

  if (!site.published) {
    const publishedCount = await db.site.count({ where: { userId: user.id, published: true } });
    const allowance = planByKey(user.plan).sites;
    if (publishedCount >= allowance) {
      return NextResponse.json(
        {
          error: `Your plan publishes ${allowance} site${allowance === 1 ? "" : "s"}. Unpublish one or upgrade.`,
          code: "PUBLISH_LIMIT",
          allowance,
        },
        { status: 409 }
      );
    }
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = site.publishSlug ?? slugify(site.name);
    try {
      const updated = await db.site.update({
        where: { id: site.id },
        data: { published: true, publishSlug: slug, publishedAt: new Date() },
        select: { publishSlug: true },
      });
      return NextResponse.json({ published: true, slug: updated.publishSlug });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "P2002" && !site.publishSlug) continue;
      throw err;
    }
  }
  return NextResponse.json({ error: "Could not allocate a URL. Try again." }, { status: 500 });
}
