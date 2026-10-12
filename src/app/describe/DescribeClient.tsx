"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Upload, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { storeDocument } from "@/lib/frameStorage";
import { MAX_DESCRIPTION, MAX_IMAGES } from "@/lib/briefLimits";
import { HANDOFF_KEY } from "@/components/PromptHero";
import OutOfCredits from "@/components/OutOfCredits";
import type { Section } from "@/lib/siteSchema";

/**
 * Describe a business, get a site.
 *
 * Photographs are downscaled here rather than sent as they come off a phone. A modern
 * camera file is several megabytes and costs tokens in proportion to its pixels, so a
 * long edge of 1024 keeps the bill in proportion to what the model can actually use.
 */

const LONG_EDGE = 1024;
const EXAMPLES = [
  "A two-chair barbershop on Mill Road, open since 2011. Walk-ins before noon, appointments after. Fades, beard trims, and we do not do colour.",
  "I repair and restore vintage film cameras, mostly Nikon and Pentax, from a workshop in Leeds. Six to eight week turnaround, and I send photographs of the work as I go.",
  "A rooftop kite shop in Ahmedabad, open only in the three weeks before Uttarayan. Paper kites and manja by the dozen, cash at the stairs.",
];

/** What the description turns into, in the order it happens. */
const WHAT_HAPPENS = [
  ["It reads what you wrote", "The street, the hours, the materials and the prices become the copy. Nothing is invented: no awards, no clients, no review scores."],
  ["It picks the look", "A palette from your trade, a typeface pairing to match, and a moving background chosen for the subject rather than for every subject."],
  ["You get the editor", "Five to nine sections, open in the editor, every word yours to change. Export it as plain HTML whenever you like."],
];

type Picked = { name: string; media_type: string; data: string; preview: string };

async function downscale(file: File): Promise<Picked> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", 0.82);
  return { name: file.name, media_type: "image/jpeg", data: url.split(",")[1] ?? "", preview: url };
}

export default function DescribeClient() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsCredits, setNeedsCredits] = useState(false);
  const [allowance, setAllowance] = useState<{
    hasKey: boolean;
    remaining: number;
    signedIn: boolean;
    canSignIn: boolean;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Whatever was typed into the box on the landing page, so nobody writes it twice.
  useEffect(() => {
    try {
      const carried = sessionStorage.getItem(HANDOFF_KEY);
      if (carried) {
        sessionStorage.removeItem(HANDOFF_KEY);
        // Not set straight from the effect body: this is a read from an external store,
        // and the compiler's lint wants that arriving through a callback.
        queueMicrotask(() => setDescription(carried.slice(0, MAX_DESCRIPTION)));
      }
    } catch {
      // Storage refused: the box simply starts empty.
    }
  }, []);

  useEffect(() => {
    let live = true;
    fetch("/api/credits")
      .then((r) => r.json())
      .then((body: { hasKey?: boolean; remaining?: number; signedIn?: boolean; canSignIn?: boolean }) => {
        if (live) {
          setAllowance({
            hasKey: Boolean(body.hasKey),
            remaining: body.remaining ?? 0,
            signedIn: Boolean(body.signedIn),
            canSignIn: Boolean(body.canSignIn),
          });
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    const room = MAX_IMAGES - images.length;
    const picked: Picked[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      try {
        picked.push(await downscale(file));
      } catch {
        setError(`${file.name} could not be read as an image.`);
      }
    }
    setImages((current) => [...current, ...picked]);
  };

  const build = async () => {
    setBusy(true);
    setError("");
    setNeedsCredits(false);
    try {
      const res = await fetch("/api/generate-site", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description,
          images: images.map(({ media_type, data }) => ({ media_type, data })),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Could not build a site from that.");
        setNeedsCredits(Boolean(body.needsCredits));
        return;
      }

      // Straight into the editor's own storage, so the editor opens it the way it opens
      // anything else somebody was working on, and the background redraws from the recipe.
      await storeDocument({
        name: body.siteName,
        description: body.siteDescription,
        sections: body.sections as Section[],
        pages: [{ slug: "index", title: body.siteName, sections: body.sections as Section[] }],
        themeJson: JSON.stringify(body.theme),
        styleJson: JSON.stringify(body.style),
        framesFromRecipe: true,
        savedAt: new Date().toISOString(),
      });
      router.push("/editor");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const short = description.trim().length < 20;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="mx-auto max-w-2xl px-6 pb-24 pt-20">
        <h1 className="lc-display text-4xl md:text-5xl">
          <span className="block">Describe the business.</span>
          <span className="block text-primary-ink">Get a site to edit.</span>
        </h1>
        <p className="mt-5 text-muted-foreground">
          Write it the way you would tell someone what you do. Street names, hours, materials and
          prices make a better site than adjectives do. Everything it writes is yours to change.
        </p>

        <ol className="mt-10 grid gap-5 border-y border-border py-7 sm:grid-cols-3">
          {WHAT_HAPPENS.map(([title, detail]) => (
            <li key={title}>
              <p className="text-sm text-foreground">{title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{detail}</p>
            </li>
          ))}
        </ol>

        <label htmlFor="description" className="mt-10 block text-sm text-muted-foreground">
          What is the business?
        </label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
          rows={7}
          placeholder={EXAMPLES[0]}
          className="mt-2 rounded-2xl border-white/10 bg-card px-4 py-3 text-base shadow-[var(--lift-1)] transition-shadow focus-visible:border-primary-ink/40 focus-visible:shadow-[var(--glow)]"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setDescription(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)])}
            className="lc-mono text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Use an example
          </button>
          <span className="lc-mono text-xs tabular-nums text-muted-foreground">
            {description.trim().length} of {MAX_DESCRIPTION}
          </span>
        </div>

        <div className="mt-8">
          <p className="text-sm text-foreground">
            Photographs, up to {MAX_IMAGES} (optional)
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your work, your room, your materials. They shape the words and the colours. They are
            sent once to write the site and are not stored.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {images.map((image, i) => (
              <span key={image.name + i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of a file the visitor just picked */}
                <img src={image.preview} alt="" className="h-20 w-20 rounded-md border border-border object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((c) => c.filter((_, j) => j !== i))}
                  aria-label={`Remove ${image.name}`}
                  className="absolute -right-2 -top-2 rounded-full border border-border bg-background p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {images.length < MAX_IMAGES && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    void addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Button variant="outline" onClick={() => fileRef.current?.click()} className="h-20 w-20 flex-col gap-1 rounded-xl border-dashed border-border">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  <span className="text-xs">Add</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {error && needsCredits && (
          <OutOfCredits
            message={error}
            canSignIn={Boolean(allowance?.canSignIn)}
            signedIn={Boolean(allowance?.signedIn)}
          />
        )}
        {error && !needsCredits && (
          <p role="alert" className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground">
            {error}
          </p>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Button onClick={build} disabled={busy || short} size="lg" className="lc-btn-solid">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {busy ? "Writing your site…" : "Build my site"}
          </Button>
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {busy ? "About half a minute." : short ? "A sentence or two to start." : "You can change every word afterwards."}
          </span>
        </div>

        <div className="mt-5 text-sm text-muted-foreground">
          {allowance?.hasKey ? (
            <>
              {allowance.remaining} {allowance.remaining === 1 ? "site" : "sites"} left{" "}
              {allowance.signedIn ? "on your account" : "on this browser"}.{" "}
              <Link href="/pricing" className="underline underline-offset-4">Top up</Link>
            </>
          ) : (
            <>
              The first site is free. Five more are $20.{" "}
              <Link href="/pricing" className="underline underline-offset-4">Pricing</Link>
              {allowance && !allowance.signedIn && (
                <>
                  {" "}Bought a pack somewhere else? Sign in and it follows you.
                </>
              )}
            </>
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
