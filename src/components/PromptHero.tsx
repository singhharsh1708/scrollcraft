"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, ImagePlus, Loader2 } from "lucide-react";
import StylePreview from "@/components/StylePreview";
import { MAX_DESCRIPTION } from "@/lib/briefLimits";

/**
 * The first screen, and the first input.
 *
 * The landing page used to ask somebody to decide which of four routes they wanted before
 * they could type anything. The thing they came to do is describe their business, so the
 * box that takes that description is the hero, and the rest of the page is what they read
 * if they are not ready yet.
 *
 * What is typed here is handed to /describe through sessionStorage rather than the URL:
 * a description belongs to the person who wrote it and has no business sitting in a
 * browser history, a referrer header or a shared link.
 */

const HERO_COLORS: [string, string, string] = ["#3b82f6", "#4338ca", "#040a1a"];
export const HANDOFF_KEY = "scrollcraft_description";

/** Short enough to sit in one row, specific enough to show the kind of detail that works. */
const EXAMPLES: [string, string][] = [
  ["Barbershop", "A two-chair barbershop on Mill Road in Cambridge, open since 2011. Walk-ins before noon, appointments after. Fades, beard trims and hot towel shaves, and we do not do colour."],
  ["Kite shop", "A rooftop kite shop in Ahmedabad, open only in the three weeks before Uttarayan. Paper kites and manja by the dozen, cash at the stairs."],
  ["Camera repair", "I repair and restore vintage film cameras, mostly Nikon and Pentax, from a workshop in Leeds. Six to eight week turnaround, and I send photographs of the work as I go."],
];

export default function PromptHero({ reducedMotion }: { reducedMotion: boolean }) {
  const router = useRouter();
  /**
   * The canvas starts once the page has finished hydrating.
   *
   * Measured before this: the largest element on the page is the sentence under the
   * headline, and 87% of its 3.6s was render delay, with 719ms of script evaluation
   * competing for the same thread. A gradient holds the ground until then, so there is
   * nothing to see arrive and nothing to shift.
   */
  const [painting, setPainting] = useState(false);
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 200));
    const handle = idle(() => setPainting(true));
    return () => {
      if (window.cancelIdleCallback && typeof handle === "number") window.cancelIdleCallback(handle);
    };
  }, []);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  const go = () => {
    setBusy(true);
    try {
      sessionStorage.setItem(HANDOFF_KEY, value.trim());
    } catch {
      // A browser that refuses storage still gets the page, just without the handoff.
    }
    router.push("/describe");
  };

  const short = value.trim().length < 20;

  return (
    <section className="relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden border-b border-border px-6 py-20">
      {painting && (
        <StylePreview
          style="wave"
          colors={HERO_COLORS}
          paused={reducedMotion}
          maxProgress={0.22}
          className="absolute inset-0 -z-10 h-full w-full"
        />
      )}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-background/70 via-background/40 to-background" />
      {/* The one place the accent is allowed to behave like a light source, directly
          under the control the whole page exists to get somebody to use. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[58%] -z-10 h-[520px] w-[820px] max-w-[120vw] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-[90px]"
        style={{ background: "radial-gradient(closest-side, oklch(0.55 0.19 256.4 / 55%), transparent)" }}
      />

      <div className="mx-auto w-full max-w-3xl text-center">
        <p className="lc-mono inline-flex flex-wrap items-center justify-center gap-x-2 rounded-full border border-white/10 bg-card/80 px-4 py-1.5 text-xs text-primary-ink shadow-[var(--lift-1)] backdrop-blur-sm">
          First four sites free
          <span className="text-muted-foreground">then 5 for $20</span>
        </p>

        <h1 className="lc-display mt-7 text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-[4rem]">
          <span className="block">Describe your business.</span>
          <span className="block text-primary-ink">Get a cinematic scroll site.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Street names, hours, materials and prices make a better site than adjectives do.
          Everything it writes is yours to change, and the export is plain HTML.
        </p>

        <div className="mt-9 rounded-2xl border border-white/10 bg-card/95 p-2 text-left shadow-[var(--lift-2)] backdrop-blur-sm transition-shadow focus-within:border-primary-ink/40 focus-within:shadow-[var(--glow)]">
          <textarea
            ref={boxRef}
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, MAX_DESCRIPTION))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !short) go();
            }}
            rows={3}
            aria-label="Describe your business"
            placeholder="What is the business? Where is it, how long has it been going, what do you actually do?"
            className="w-full resize-none bg-transparent px-4 py-4 text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between gap-3 px-4 pb-2">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              {short ? "Photographs optional" : `${value.trim().length} characters`}
            </span>
            {/* Not faded out when it is not ready: a button nobody can read is worse
                than one that plainly says it is waiting for a sentence. */}
            <button
              type="button"
              onClick={go}
              disabled={short || busy}
              className={`lc-btn lc-btn-sm ${short || busy ? "lc-btn-ghost text-muted-foreground" : "lc-btn-solid"}`}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-4 w-4" aria-hidden="true" />}
              Write my site
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <span className="lc-mono py-1.5 text-xs text-muted-foreground">Try one:</span>
          {EXAMPLES.map(([label, text]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setValue(text);
                boxRef.current?.focus();
              }}
              className="lc-mono rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary-ink/40 hover:text-foreground"
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mt-7 text-sm text-muted-foreground">
          Rather start from a finished design?{" "}
          <Link href="/templates" className="underline underline-offset-4 hover:text-foreground">
            Browse 23 templates
          </Link>
        </p>
      </div>
    </section>
  );
}
