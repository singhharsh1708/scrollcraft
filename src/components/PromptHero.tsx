"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, ChevronDown, Loader2 } from "lucide-react";
import StylePreview from "@/components/StylePreview";
import AttachmentBar, { AttachmentChips, useAttachments } from "@/components/Attachments";
import { MAX_DESCRIPTION } from "@/lib/briefLimits";
import { extractFramesInBrowser } from "@/lib/extractFramesInBrowser";
import { writeSite } from "@/lib/writeSite";
import { DEFAULT_QUALITY, QUALITIES, type Quality } from "@/lib/quality";

/**
 * The first screen, and the first input.
 *
 * The landing page used to ask somebody to decide which of four routes they wanted before
 * they could type anything. The thing they came to do is describe their business, so the
 * box that takes that description is the hero, and the rest of the page is what they read
 * if they are not ready yet.
 *
 * Pressing the button writes the site right here and opens it in the editor; /describe adds
 * a contact link.
 */

const HERO_COLORS: [string, string, string] = ["#3b82f6", "#4338ca", "#040a1a"];
export const HANDOFF_KEY = "scrollcraft_description";

/** Short enough to sit in one row, specific enough to show the kind of detail that works. */
const EXAMPLES: [string, string][] = [
  ["Barbershop", "A two-chair barbershop on Mill Road in Cambridge, open since 2011. Walk-ins before noon, appointments after. Fades, beard trims and hot towel shaves, and we do not do colour."],
  ["Kite shop", "A rooftop kite shop in Ahmedabad, open only in the three weeks before Uttarayan. Paper kites and manja by the dozen, cash at the stairs."],
  ["Tiffin service", "Maharashtrian lunch tiffins from a home kitchen in Kothrud, Pune, since 2016. Two sabzis, dal, rice and chapatis at your office by 1 pm. Monthly plans only, and no onion or garlic on Thursdays."],
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
  const attach = useAttachments();
  const [videoPct, setVideoPct] = useState<number | null>(null);

  const [quality, setQuality] = useState<Quality>(DEFAULT_QUALITY);
  const [left, setLeft] = useState<{ free: number | null; paid: number } | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/credits", { cache: "no-store" })
      .then((r) => r.json())
      .then((body: { freeLeft?: number | null; remaining?: number }) => {
        if (live) setLeft({ free: body.freeLeft ?? null, paid: body.remaining ?? 0 });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const [error, setError] = useState("");
  const [needsCredits, setNeedsCredits] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  const go = async () => {
    if (short || busy) return;
    setElapsed(0);
    setBusy(true);
    setError("");
    setNeedsCredits(false);
    let videoFrames: string[] | undefined;
    if (attach.video) {
      setVideoPct(0);
      try {
        const file = attach.video.type ? attach.video : new File([attach.video], attach.video.name, { type: "video/mp4" });
        videoFrames = (await extractFramesInBrowser(file, { frameCount: 120, onProgress: (pct) => setVideoPct(Math.round(pct)) })).frames;
      } catch (err) {
        setError(err instanceof Error ? err.message : "That video could not be read.");
        setVideoPct(null);
        setBusy(false);
        return;
      }
      setVideoPct(100);
      setElapsed(0);
    }
    const result = await writeSite({
      description: value.trim(),
      quality,
      images: attach.images.map(({ media_type, data }) => ({ media_type, data })),
      documents: attach.doc ? [{ name: attach.doc.name, media_type: attach.doc.media_type, data: attach.doc.data }] : [],
      videoFrames,
    });
    if (result.ok) {
      router.push("/editor");
      return;
    }
    setError(result.error);
    setNeedsCredits(result.needsCredits);
    setVideoPct(null);
    setBusy(false);
  };

  const handOff = () => {
    try {
      sessionStorage.setItem(HANDOFF_KEY, value.trim());
    } catch {
      // Storage refused: /describe opens empty.
    }
  };

  const typed = value.trim().length;
  const short = typed < 20;
  const allowance =
    left === null
      ? "No sign-up needed"
      : left.paid > 0
        ? `${left.paid} ${left.paid === 1 ? "site" : "sites"} on your account`
        : left.free === null
          ? "No sign-up needed"
          : left.free > 0
            ? `${left.free} free ${left.free === 1 ? "site" : "sites"} left`
            : "Free sites used · 5 more for $20";
  const hint = typed === 0 ? allowance : short ? `${20 - typed} more character${20 - typed === 1 ? "" : "s"}` : allowance;

  return (
    <section className="relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden border-b border-border px-4 py-10 sm:px-6 sm:py-20">
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
          First two sites free
          <span className="text-muted-foreground">then 5 for $20</span>
        </p>

        <h1 className="lc-display mt-5 text-[2.15rem] sm:mt-7 leading-[1.08] sm:text-6xl lg:text-[4rem]">
          <span className="block">Describe your business.</span>
          <span className="block text-primary-ink">Get a website that moves as you scroll.</span>
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
          Type a few lines and add photos, a video or a document like a menu or resume. In about
          half a minute you get a site that moves as you scroll, ready to edit.
        </p>

        <div
          id="write"
          onDragOver={(e) => {
            if (!busy && e.dataTransfer.types.includes("Files")) e.preventDefault();
          }}
          onDrop={(e) => {
            if (busy || !e.dataTransfer.files.length) return;
            e.preventDefault();
            void attach.addAny(e.dataTransfer.files);
          }}
          className="mt-6 scroll-mt-28 rounded-3xl sm:mt-9 border border-white/15 bg-card/95 p-2 text-left shadow-[var(--lift-2)] ring-1 ring-primary-ink/10 backdrop-blur-sm transition-shadow focus-within:border-primary-ink/40 focus-within:shadow-[var(--glow)]"
        >
          <textarea
            ref={boxRef}
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, MAX_DESCRIPTION))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void go();
              }
            }}
            rows={4}
            disabled={busy}
            aria-label="Describe your business"
            placeholder="What is the business? Where is it, how long has it been going, what do you actually do?"
            className="w-full resize-none rounded-2xl bg-transparent px-4 py-4 text-base leading-relaxed text-foreground outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring placeholder:text-muted-foreground"
          />
          <AttachmentChips state={attach} disabled={busy} />
          <div className="flex flex-col gap-3 border-t border-white/10 px-2 pb-1 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <AttachmentBar state={attach} disabled={busy} />
            <div className="flex items-center justify-end gap-2">
              <label className="sr-only" htmlFor="hero-quality">Quality</label>
              <div className="relative">
              <select
                id="hero-quality"
                value={quality}
                disabled={busy}
                onChange={(e) => setQuality(e.target.value as Quality)}
                title="Fast is quickest, Best writes most carefully. Each uses one site."
                className="lc-mono h-11 sm:h-9 cursor-pointer appearance-none rounded-full border border-border bg-transparent pl-4 pr-9 text-base sm:text-xs text-muted-foreground outline-none hover:border-foreground/30 focus-visible:border-primary-ink/60 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {(Object.keys(QUALITIES) as Quality[]).map((q) => (
                  <option key={q} value={q} className="bg-card text-foreground">
                    {QUALITIES[q].label}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
              {/* Not faded out when it is not ready: it plainly says it is waiting for a sentence. */}
              <button
                type="button"
                onClick={() => void go()}
                disabled={short || busy}
                className={`lc-btn lc-btn-sm max-sm:h-11 max-sm:flex-1 ${short || busy ? "lc-btn-ghost text-muted-foreground" : "lc-btn-solid"}`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-4 w-4" aria-hidden="true" />}
                {busy ? "Writing…" : "Write my site"}
              </button>
            </div>
          </div>
          <p className="px-3 pb-2 pt-2 text-xs text-muted-foreground">{hint}</p>
        </div>

        {busy && <Progress elapsed={elapsed} wait={QUALITIES[quality].wait} videoPct={videoPct} />}
        {error && (
          <div role="alert" className="mt-4 rounded-2xl border border-primary-ink/30 bg-card/95 p-4 text-left text-sm text-foreground">
            <p>{error}</p>
            <p className="mt-2 text-muted-foreground">
              {needsCredits ? (
                <>
                  <Link href="/pricing" className="underline underline-offset-4 hover:text-foreground">Get 5 more sites for $20</Link>, or{" "}
                  <Link href="/templates" className="underline underline-offset-4 hover:text-foreground">start from a free template</Link>.
                </>
              ) : (
                <>
                  Meanwhile, every{" "}
                  <Link href="/templates" className="underline underline-offset-4 hover:text-foreground">template</Link> is free to edit and export.
                </>
              )}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <span className="lc-mono inline-flex items-center py-1.5 text-xs text-muted-foreground">Try one:</span>
          {EXAMPLES.map(([label, text]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setValue(text);
                boxRef.current?.focus();
              }}
              className="lc-mono inline-flex items-center min-h-11 sm:min-h-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary-ink/40 hover:text-foreground"
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mt-7 text-sm text-muted-foreground">
          Want call or WhatsApp buttons?{" "}
          <Link href="/describe" onClick={handOff} className="underline underline-offset-4 hover:text-foreground">
            Use the full form
          </Link>
          <span className="mx-2" aria-hidden="true">·</span>
          Rather start from a finished design?{" "}
          <Link href="/templates" className="underline underline-offset-4 hover:text-foreground">
            Browse 23 templates
          </Link>
        </p>
      </div>
    </section>
  );
}

const STEPS = ["Reading your description", "Writing the sections", "Choosing colours and type", "Opening the editor"];

function Progress({ elapsed, wait, videoPct }: { elapsed: number; wait: string; videoPct: number | null }) {
  const reading = videoPct !== null && videoPct < 100;
  const current = reading ? -1 : Math.min(STEPS.length - 1, Math.floor(elapsed / 9));
  return (
    <div role="status" aria-live="polite" className="mt-4 rounded-2xl border border-white/10 bg-card/95 p-4 text-left shadow-[var(--lift-1)]">
      <ol className="space-y-2 text-sm">
        {videoPct !== null && (
          <li className="flex items-center gap-2 text-foreground">
            {reading ? <Loader2 className="h-4 w-4 animate-spin text-primary-ink" aria-hidden="true" /> : <Check className="h-4 w-4 text-primary-ink" aria-hidden="true" />}
            Reading your video on this device{reading ? ` (${videoPct}%)` : ""}
          </li>
        )}
        {STEPS.map((step, i) => (
          <li key={step} className={`flex items-center gap-2 ${i > current ? "text-muted-foreground/60" : "text-foreground"}`}>
            {i < current ? (
              <Check className="h-4 w-4 text-primary-ink" aria-hidden="true" />
            ) : i === current ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary-ink" aria-hidden="true" />
            ) : (
              <span className="h-4 w-4 rounded-full border border-border" aria-hidden="true" />
            )}
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">{elapsed}s · {wait} Keep this tab open.</p>
    </div>
  );
}
