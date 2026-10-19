import { notFound } from "next/navigation";
import { TEMPLATES, templateBySlug } from "@/lib/templates";
import TemplatePreview from "./TemplatePreview";
import TemplateDetails from "./TemplateDetails";

export const dynamicParams = false;

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ slug: t.slug }));
}

export default async function TemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const template = templateBySlug(slug);
  if (!template) notFound();

  return (
    <>
      <TemplatePreview template={template} />
      <TemplateDetails template={template} />
    </>
  );
}
