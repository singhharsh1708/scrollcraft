import type { Metadata } from "next";
import { templateBySlug } from "@/lib/templates";

/**
 * The page itself is a client component, so its title and canonical live here.
 *
 * Without this every template preview shared the site's default title and claimed no
 * address of its own, so 21 pages looked like one page to a crawler and to anyone
 * reading their browser tabs.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const template = templateBySlug(slug);
  const canonical = `/templates/${slug}`;
  if (!template) return { alternates: { canonical } };
  return {
    title: `${template.name} template`,
    description: template.tagline,
    alternates: { canonical },
  };
}

export default function TemplateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
