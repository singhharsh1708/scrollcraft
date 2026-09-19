import type { Metadata } from "next";

export const SHARE_BASE = { type: "website", locale: "en_US", siteName: "ScrollCraft" } as const;

type ShareImage = { url: string; width: number; height: number; alt: string };

/**
 * Title, description, canonical and share card for one route.
 *
 * A route's openGraph replaces the root's outright, so it is built here with the root's
 * siteName, type and locale every time. Leaving images out keeps the root's generated card.
 */
export function pageMeta({
  title,
  description,
  path,
  image,
}: {
  title: string;
  description: string;
  path: string;
  image?: ShareImage;
}): Metadata {
  const shareTitle = `${title} | ScrollCraft`;
  const images = image ? [image] : undefined;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...SHARE_BASE, title: shareTitle, description, url: path, ...(images && { images }) },
    twitter: { card: "summary_large_image", title: shareTitle, description, ...(images && { images }) },
  };
}
