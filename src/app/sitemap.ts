import { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // /create, /editor and /dashboard are intentionally absent: they require a session and
  // are disallowed in robots.ts. Listing /create here as well produced "Indexed, though
  // blocked by robots.txt" in Search Console.
  return [
    { url: siteUrl,              lastModified: now, changeFrequency: "weekly",  priority: 1 },
    { url: `${siteUrl}/presets`, lastModified: now, changeFrequency: "weekly",  priority: 0.9 },
    { url: `${siteUrl}/showcase`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/about`,   lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/privacy`, lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${siteUrl}/terms`,   lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
  ];
}
