import "server-only";
import { db } from "@/lib/db";
import {
  parseSectionsJson,
  parseStyleJson,
  parseThemeJson,
  visibleSections,
  type Section,
  type SiteStyle,
  type Theme,
} from "@/lib/siteSchema";
import { sanitizeHostedCss } from "@/lib/themeCss";

export interface PublishedSite {
  name: string;
  sections: Section[];
  theme: Theme | null;
  styleSpec: SiteStyle | null;
  frameUrls: string[] | null;
  customCss: string;
  /** Free-plan pages carry the badge and are noindexed; publish is the funnel. */
  badge: boolean;
}

function frameUrlsFrom(framesJson: string | null): string[] | null {
  if (!framesJson) return null;
  try {
    const decoded: unknown = JSON.parse(framesJson);
    if (!Array.isArray(decoded)) return null;
    const urls = decoded.filter(
      (f): f is string => typeof f === "string" && /^https?:\/\//i.test(f)
    );
    return urls.length === decoded.length && urls.length > 0 ? urls : null;
  } catch {
    return null;
  }
}

export async function getPublishedSite(slug: string): Promise<PublishedSite | null> {
  if (!slug || slug.length > 120) return null;

  const site = await db.site.findFirst({
    where: { publishSlug: slug, published: true },
    select: {
      name: true,
      sectionsJson: true,
      themeJson: true,
      styleJson: true,
      framesJson: true,
      customCss: true,
      user: { select: { plan: true } },
    },
  });
  if (!site) return null;

  const sections = parseSectionsJson(site.sectionsJson ?? "[]");
  if (!sections.ok || visibleSections(sections.sections).length === 0) return null;

  const theme = site.themeJson ? parseThemeJson(site.themeJson) : null;
  const style = site.styleJson ? parseStyleJson(site.styleJson) : null;
  const frameUrls = frameUrlsFrom(site.framesJson);
  const styleSpec = style?.ok ? style.value : null;

  // A page with neither a background recipe nor hosted frame URLs would render the silent
  // black canvas. Publishing validates this too; this guards rows edited since.
  if (!styleSpec && !frameUrls) return null;

  return {
    name: site.name,
    sections: sections.sections,
    theme: theme?.ok ? theme.value : null,
    styleSpec,
    frameUrls,
    // customHead is deliberately never served: it may carry scripts, which are fine in the
    // user's own exported ZIP but are XSS on this origin.
    customCss: sanitizeHostedCss(site.customCss),
    badge: site.user.plan === "FREE",
  };
}
