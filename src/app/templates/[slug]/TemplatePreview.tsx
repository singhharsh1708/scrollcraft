"use client";
import { useMemo } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import SiteRenderer from "@/components/SiteRenderer";
import type { Template } from "@/lib/templates";

export default function TemplatePreview({ template }: { template: Template }) {
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
      openOnHeadline
      hostHasH1
    >
      <nav aria-label="Template" className="fixed top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 z-40 flex items-center justify-between gap-3 pointer-events-none">
        <Link
          href="/templates"
          className={buttonVariants({ size: "sm", variant: "outline", className: "pointer-events-auto border-white/15 bg-black/50 backdrop-blur h-11 md:h-8 text-xs gap-1.5" })}
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Templates
        </Link>
        <Link
          href={`/editor?template=${template.slug}`}
          className={buttonVariants({ size: "sm", className: "pointer-events-auto h-11 md:h-8 text-xs gap-1.5 px-2.5 sm:px-3" })}
        >
          Use this template <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </nav>
    </SiteRenderer>
  );
}
