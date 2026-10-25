import { deleteFrames, storeDocument, storeFrames } from "@/lib/frameStorage";
import { withContactLink } from "@/lib/contactLink";
import type { Section } from "@/lib/siteSchema";

/** Tells the editor it is opening a site that was just written. */
export const FRESH_SITE_KEY = "scrollcraft_fresh";
/** Same keys the editor saves to, so a cold open restores these frames. */
const VIDEO_FRAMES_KEY = "scrollcraft_saved_frames";
const VIDEO_MOBILE_FRAMES_KEY = "scrollcraft_saved_mframes";

export type WriteResult = { ok: true } | { ok: false; error: string; needsCredits: boolean };

/** Ask the server for a site and store it where the editor opens it. */
export async function writeSite(input: {
  description: string;
  images?: { media_type: string; data: string }[];
  documents?: { name: string; media_type: string; data: string }[];
  /** Frames from the owner's video, which replace the generated background. */
  videoFrames?: string[];
  contactHref?: string | null;
  quality?: string;
}): Promise<WriteResult> {
  let res: Response;
  try {
    res = await fetch("/api/generate-site", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: input.description, images: input.images ?? [], documents: input.documents ?? [], quality: input.quality }),
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

  const frames = input.videoFrames ?? [];
  const video = frames.length > 0;
  if (video) {
    try {
      await storeFrames(VIDEO_FRAMES_KEY, frames);
      await deleteFrames(VIDEO_MOBILE_FRAMES_KEY).catch(() => {});
    } catch {
      return { ok: false, error: "This browser would not store the video frames. Try again without the video.", needsCredits: false };
    }
  }
  const sections = withContactLink(body.sections as Section[], input.contactHref ?? null);
  await storeDocument({
    name: body.siteName as string,
    description: body.siteDescription as string,
    sections,
    pages: [{ slug: "index", title: body.siteName as string, sections }],
    themeJson: JSON.stringify(body.theme),
    styleJson: JSON.stringify(body.style),
    framesFromRecipe: !video,
    ...(video ? { framesKey: VIDEO_FRAMES_KEY, fps: 24 } : {}),
    openOnHeadline: true,
    savedAt: new Date().toISOString(),
  });
  try {
    sessionStorage.setItem(FRESH_SITE_KEY, "1");
  } catch {
    // Storage can be blocked; the editor then shows its usual message.
  }
  return { ok: true };
}
