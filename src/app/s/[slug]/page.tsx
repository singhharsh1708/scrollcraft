import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteRenderer from "@/components/SiteRenderer";
import { getPublishedSite } from "@/lib/publishedSite";

// Cache the rendered page per slug; a publish/unpublish changes the row, and stale reads
// for up to a minute are acceptable for a public marketing page.
export const revalidate = 60;

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublishedSite(slug);
  if (!site) return { title: "Not found" };
  return {
    title: site.name,
    robots: site.badge ? { index: false, follow: false } : undefined,
  };
}

export default async function PublishedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getPublishedSite(slug);
  if (!site) notFound();

  return (
    <SiteRenderer
      name={site.name}
      sections={site.sections}
      theme={site.theme}
      styleSpec={site.styleSpec}
      frameUrls={site.frameUrls}
      cacheKey={`scrollcraft_published_${slug}`}
      customCss={site.customCss}
      badge={site.badge}
    />
  );
}
