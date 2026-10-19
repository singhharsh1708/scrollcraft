import { storeDocument } from "@/lib/frameStorage";
import { withContactLink } from "@/lib/contactLink";
import type { Section } from "@/lib/siteSchema";

export type WriteResult = { ok: true } | { ok: false; error: string; needsCredits: boolean };

/** Ask the server for a site and store it where the editor opens it. */
export async function writeSite(input: {
  description: string;
  images?: { media_type: string; data: string }[];
  contactHref?: string | null;
  quality?: string;
}): Promise<WriteResult> {
  let res: Response;
  try {
    res = await fetch("/api/generate-site", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: input.description, images: input.images ?? [], quality: input.quality }),
    });
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection and try again.", needsCredits: false };
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = JSON.parse(await res.text());
  } catch {
    // The platform's own timeout page is not JSON.
  }
  if (!body) return { ok: false, error: "The server took too long to answer. Try again in a minute.", needsCredits: false };
  if (!res.ok) {
    return { ok: false, error: typeof body.error === "string" ? body.error : "Could not build a site from that.", needsCredits: Boolean(body.needsCredits) };
  }

  const sections = withContactLink(body.sections as Section[], input.contactHref ?? null);
  await storeDocument({
    name: body.siteName as string,
    description: body.siteDescription as string,
    sections,
    pages: [{ slug: "index", title: body.siteName as string, sections }],
    themeJson: JSON.stringify(body.theme),
    styleJson: JSON.stringify(body.style),
    framesFromRecipe: true,
    savedAt: new Date().toISOString(),
  });
  return { ok: true };
}
