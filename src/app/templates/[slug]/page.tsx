"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Lock, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import SiteRenderer from "@/components/SiteRenderer";
import { templateBySlug, templateSectionCount, type Template } from "@/lib/templates";
import type { Section } from "@/lib/siteSchema";

type Ownership = "loading" | "owned" | "locked" | "signin";

export default function TemplatePreview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const template = templateBySlug(slug);
  if (!template) notFound();

  return template.premium ? (
    <PremiumPreview template={template} />
  ) : (
    <Preview template={template} sections={template.sections}>
      <Link href={`/editor?template=${template.slug}`} className="pointer-events-auto">
        <Button size="sm" className="h-8 text-xs gap-1.5">
          Use this template <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </Link>
    </Preview>
  );
}

/** The scroll preview itself, plus whatever action belongs in the top bar. */
function Preview({
  template,
  sections,
  children,
}: {
  template: Template;
  sections: Section[];
  children: React.ReactNode;
}) {
  // SiteRenderer regenerates its frames whenever `styleSpec` changes identity, so this
  // has to be a stable object. Passing a fresh literal restarted generation on every
  // re-render, which left the premium preview stuck on "Rendering frames…" forever once
  // the ownership check gave the component something to re-render for.
  const styleSpec = useMemo(
    () => ({ style: template.style, colors: template.colors }),
    [template.style, template.colors]
  );

  return (
    <SiteRenderer
      name={template.name}
      sections={sections}
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
        {children}
      </div>
    </SiteRenderer>
  );
}

function PremiumPreview({ template }: { template: Template }) {
  // Starts with the teaser, which is all the browser bundle carries. If the visitor owns
  // the template the entitlement route returns the rest and the preview becomes complete.
  const [sections, setSections] = useState<Section[]>(template.sections);
  const [state, setState] = useState<Ownership>("loading");
  const [checkingOut, setCheckingOut] = useState(false);

  // Resolve ownership by asking the entitlement route: 200 means the sections came back,
  // 402 means it is locked, 401 means nobody is signed in.
  const resolveOwnership = useCallback(async (slug: string) => {
    const res = await fetch(`/api/templates/${slug}`);
    if (res.status === 401) return { state: "signin" as Ownership, sections: null };
    if (res.status === 402) return { state: "locked" as Ownership, sections: null };
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const secs = Array.isArray(data.sections) && data.sections.length ? (data.sections as Section[]) : null;
    return { state: "owned" as Ownership, sections: secs };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { state: next, sections: secs } = await resolveOwnership(template.slug);
        if (cancelled) return;
        if (secs) setSections(secs);
        setState(next);
      } catch {
        if (!cancelled) setState("locked");
      }
    })();
    return () => { cancelled = true; };
  }, [template.slug, resolveOwnership]);

  const handleUnlock = async () => {
    setCheckingOut(true);
    try {
      const res = await fetch("/api/payments/template-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: template.slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.assign(`/auth/signin?callbackUrl=/templates/${template.slug}`);
        return;
      }
      if (data.alreadyPurchased) {
        toast.success("You already own this — loading it now.");
        const { state: next, sections: secs } = await resolveOwnership(template.slug);
        if (secs) setSections(secs);
        setState(next);
        return;
      }
      if (res.status === 503) {
        toast.error("Template purchases aren't available right now. Try again later.");
        return;
      }
      if (!res.ok || !data.checkoutUrl) {
        toast.error(data.error || "Couldn't start checkout. Please try again.");
        return;
      }
      window.location.assign(data.checkoutUrl);
    } catch {
      toast.error("Couldn't start checkout. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  };

  const hidden = Math.max(templateSectionCount(template) - template.sections.length, 0);

  return (
    <Preview template={template} sections={sections}>
      {state === "owned" ? (
        <Link href={`/editor?template=${template.slug}`} className="pointer-events-auto">
          <Button size="sm" className="h-8 text-xs gap-1.5">
            <Check className="w-3.5 h-3.5" /> Use this template
          </Button>
        </Link>
      ) : (
        <Button
          size="sm"
          disabled={state === "loading" || checkingOut}
          onClick={handleUnlock}
          className="pointer-events-auto h-8 text-xs gap-1.5 bg-amber-400 hover:bg-amber-300 text-black font-semibold"
        >
          {checkingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
          {state === "signin" ? "Sign in to unlock" : "Unlock template"}
        </Button>
      )}

      {state !== "owned" && state !== "loading" && hidden > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-auto max-w-md w-[calc(100%-2rem)]">
          <div className="rounded-2xl border border-amber-400/30 bg-black/80 backdrop-blur px-5 py-4 text-center">
            <p className="text-sm font-semibold mb-1">
              You&apos;re seeing the opening section
            </p>
            <p className="text-xs text-white/70 mb-3">
              {hidden} more {hidden === 1 ? "section is" : "sections are"}{" "}
              written and waiting. Unlock once and it&apos;s yours to edit and export
              forever.
            </p>
            <Button
              size="sm"
              disabled={checkingOut}
              onClick={handleUnlock}
              className="h-8 text-xs bg-amber-400 hover:bg-amber-300 text-black font-semibold"
            >
              {checkingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              {state === "signin" ? "Sign in to unlock" : "Unlock this template"}
            </Button>
          </div>
        </div>
      )}
    </Preview>
  );
}
