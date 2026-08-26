import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { parseSectionsJson, parseStyleJson, parseThemeJson } from "@/lib/siteSchema";
import { planByKey } from "@/lib/plans";

// The schema alone admits ~11 MB per call; without a cap a client could stream far more
// before Zod ever sees it.
const MAX_BODY_BYTES = 12_000_000;
// Hard ceiling regardless of plan, so a loop of `POST /api/sites` with no id cannot fill
// the table with 10 MB rows.
const MAX_SITES_PER_USER = 100;

const siteSchema = z.object({
  id: z.string().optional(),
  name: z.string().max(255).optional(),
  description: z.string().max(300).optional(),
  fps: z.number().int().min(1).max(120).optional(),
  frameCount: z.number().int().min(0).max(100_000).optional(),
  framesJson: z.string().max(10_000_000).optional(),
  sectionsJson: z.string().max(1_000_000).optional(),
  themeJson: z.string().max(5_000).optional(),
  styleJson: z.string().max(500).optional(),
  customHead: z.string().max(50_000).optional(),
  customCss: z.string().max(50_000).optional(),
  // z.url() accepts any scheme, javascript: and data: included. Nothing renders this
  // into an href today, but it is persisted and handed back to the client, so pin it to
  // the two schemes an audio track can actually be fetched over.
  audioUrl: z
    .string()
    .max(2000)
    .refine((v) => /^https?:\/\//i.test(v), { message: "audioUrl must be an http(s) URL" })
    .optional()
    .or(z.literal("")),
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
    select: { id: true, name: true, frameCount: true, fps: true, published: true, publishSlug: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ sites });
}

// POST /api/sites — create or update a site
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(getClientIp(req), { bucket: "sites", limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, plan: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // A malformed body threw SyntaxError straight out of the handler, producing a bare 500
  // with no JSON at all rather than a 400.
  const body = await req.text();
  if (body.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = siteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { id, name, description, fps, frameCount, framesJson, sectionsJson, themeJson, styleJson, customHead, customCss, audioUrl } = parsed.data;

  if (sectionsJson !== undefined) {
    const sections = parseSectionsJson(sectionsJson);
    if (!sections.ok) {
      return NextResponse.json(
        { error: "Invalid request", details: { sectionsJson: [sections.error] } },
        { status: 400 }
      );
    }
  }
  if (themeJson !== undefined) {
    const theme = parseThemeJson(themeJson);
    if (!theme.ok) {
      return NextResponse.json(
        { error: "Invalid request", details: { themeJson: [theme.error] } },
        { status: 400 }
      );
    }
  }
  if (styleJson !== undefined) {
    const style = parseStyleJson(styleJson);
    if (!style.ok) {
      return NextResponse.json(
        { error: "Invalid request", details: { styleJson: [style.error] } },
        { status: 400 }
      );
    }
  }

  if (id) {
    // Update existing site — verify ownership
    const existing = await db.site.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const site = await db.site.update({
      where: { id },
      data: { name, description, fps, frameCount, framesJson, sectionsJson, themeJson, styleJson, customHead, customCss, audioUrl },
    });
    return NextResponse.json({ site });
  }

  // Create new site
  const siteCount = await db.site.count({ where: { userId: user.id } });
  const allowance = Math.min(planByKey(user.plan).sites, MAX_SITES_PER_USER);
  if (siteCount >= allowance) {
    return NextResponse.json(
      {
        error: `Your plan keeps ${allowance} saved website${allowance === 1 ? "" : "s"}. Delete one or upgrade to make room.`,
        code: "SITE_LIMIT",
        allowance,
      },
      { status: 409 }
    );
  }

  const site = await db.site.create({
    data: { userId: user.id, name, description, fps, frameCount, framesJson, sectionsJson, themeJson, styleJson, customHead, customCss, audioUrl },
  });
  return NextResponse.json({ site });
}
