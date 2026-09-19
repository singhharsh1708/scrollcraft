import type { Metadata } from "next";

export const SHARE_BASE = { type: "website", locale: "en_US", siteName: "ScrollCraft" } as const;

type ShareImage = { url: string; width: number; height: number; alt: string };

/** The card src/app/opengraph-image.tsx draws. A route that sets openGraph loses it unless it names it again. */
export const DEFAULT_SHARE_IMAGE: ShareImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "ScrollCraft, cinematic scroll websites exported as plain HTML",
};

/**
 * Title, description, canonical and share card for one route.
 *
 * A route's openGraph replaces the root's outright, so it is built here with the root's
 * siteName, type, locale and card image every time.
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
  const images = [image ?? DEFAULT_SHARE_IMAGE];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...SHARE_BASE, title: shareTitle, description, url: path, images },
    twitter: { card: "summary_large_image", title: shareTitle, description, images },
  };
}
