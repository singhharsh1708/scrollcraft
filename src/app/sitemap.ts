import { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { TEMPLATES, templateCategories } from "@/lib/templates";
import { categoryPath } from "@/lib/templateSeo";

/**
 * Every page worth indexing, and no lastModified on any of them.
 *
 * It used to carry one: the build timestamp, on all of them, which says every page
 * changed every time anything was deployed. A crawler that cannot trust the field
 * ignores it, so stating nothing is more honest than stating that.
 *
 * /create and /editor are intentionally absent: they are the tool itself and are
 * disallowed in robots.ts. Listing /create here as well produced "Indexed, though
 * blocked by robots.txt" in Search Console.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl,                 changeFrequency: "weekly",  priority: 1 },
    { url: `${siteUrl}/describe`,   changeFrequency: "weekly",  priority: 0.9 },
    { url: `${siteUrl}/templates`,  changeFrequency: "weekly",  priority: 0.9 },
    ...TEMPLATES.map((t) => ({
      url: `${siteUrl}/templates/${t.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...templateCategories().map((c) => ({
      url: `${siteUrl}${categoryPath(c)}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${siteUrl}/examples`,   changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/pricing`,    changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/ui`,         changeFrequency: "weekly",  priority: 0.8 },
    { url: `${siteUrl}/presets`,    changeFrequency: "weekly",  priority: 0.6 },
    { url: `${siteUrl}/changelog`,  changeFrequency: "weekly",  priority: 0.5 },
    { url: `${siteUrl}/about`,      changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/contact`,    changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/privacy`,    changeFrequency: "yearly",  priority: 0.3 },
    { url: `${siteUrl}/terms`,      changeFrequency: "yearly",  priority: 0.3 },
    { url: `${siteUrl}/cookies`,    changeFrequency: "yearly",  priority: 0.3 },
    { url: `${siteUrl}/refunds`,    changeFrequency: "yearly",  priority: 0.3 },
  ];
}
