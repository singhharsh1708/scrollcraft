import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXTAUTH_URL ?? "https://scrollcraft.app";
  const now = new Date();

  return [
    { url: base,              lastModified: now, changeFrequency: "weekly",  priority: 1 },
    { url: `${base}/create`,  lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/presets`, lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/about`,   lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}
