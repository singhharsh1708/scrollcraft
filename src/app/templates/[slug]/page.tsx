"use client";
import { use, useMemo } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import SiteRenderer from "@/components/SiteRenderer";
import { templateBySlug, type Template } from "@/lib/templates";

export default function TemplatePreview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const template = templateBySlug(slug);
  if (!template) notFound();

  return <Preview template={template} />;
}

function Preview({ template }: { template: Template }) {
  // SiteRenderer regenerates its frames whenever `styleSpec` changes identity, so this
  // has to be a stable object — a fresh literal restarted generation on every re-render
  // and left the preview stuck on "Rendering frames…".
  const styleSpec = useMemo(
    () => ({ style: template.style, colors: template.colors }),
    [template.style, template.colors]
  );

  return (
    <SiteRenderer
      name={template.name}
      sections={template.sections}
      theme={template.theme}
      styleSpec={styleSpec}
      cacheKey={`scrollcraft_template_${template.slug}`}
    >
      <div className="fixed top-4 left-4 right-4 z-40 flex items-center justify-between gap-3 pointer-events-none">
        <Link href="/templates" className="pointer-events-auto">
          <Button size="sm" variant="outline" className="border-white/15 bg-black/50 backdrop-blur h-8 text-xs gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Templates
          </Button>
        </Link>
        <Link href={`/editor?template=${template.slug}`} className="pointer-events-auto">
          <Button size="sm" className="h-8 text-xs gap-1.5">
            Use this template <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>
    </SiteRenderer>
  );
}
