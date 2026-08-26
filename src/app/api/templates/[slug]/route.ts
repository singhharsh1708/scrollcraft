import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { templateBySlug } from "@/lib/templates";
import { fullTemplateSections } from "@/lib/premiumTemplateSections";

/**
 * GET /api/templates/[slug] — the sections needed to open a template in the editor.
 *
 * A free template's sections are already in the client bundle, so this is only load
 * bearing for the premium ones: their content is withheld server-side and served here
 * only to someone who has bought it.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const template = templateBySlug(slug);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // A free template is public: no session, no lookup, just the sections.
  if (!template.premium) {
    return NextResponse.json({ slug, premium: false, sections: template.sections });
  }

  const rl = await rateLimit(getClientIp(req), {
    bucket: "template-sections",
    limit: 60,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in to unlock this template", code: "AUTH_REQUIRED" },
      { status: 401 }
    );
  }

  const purchase = await db.templatePurchase.findFirst({
    where: { userId: session.user.id, templateSlug: slug, status: "PAID" },
    select: { id: true },
  });
  if (!purchase) {
    return NextResponse.json(
      { error: "This template hasn't been unlocked on this account", code: "PURCHASE_REQUIRED" },
      { status: 402 }
    );
  }

  return NextResponse.json({
    slug,
    premium: true,
    sections: fullTemplateSections(template),
  });
}
