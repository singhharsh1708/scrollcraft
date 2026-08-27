import { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { TEMPLATES } from "@/lib/templates";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // /create and /editor are intentionally absent: they are the tool itself and
  // are disallowed in robots.ts. Listing /create here as well produced "Indexed, though
  // blocked by robots.txt" in Search Console.
  return [
    { url: siteUrl,                lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/templates`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...TEMPLATES.map((t) => ({
      url: `${siteUrl}/templates/${t.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${siteUrl}/presets`, lastModified: now, changeFrequency: "weekly",  priority: 0.6 },
    { url: `${siteUrl}/about`,   lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/privacy`, lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${siteUrl}/terms`,   lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
  ];
}
