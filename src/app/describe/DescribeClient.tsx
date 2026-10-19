"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Upload, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { writeSite } from "@/lib/writeSite";
import { MAX_DESCRIPTION, MAX_IMAGES } from "@/lib/briefLimits";
import { contactLink, readPhone, type ContactVia } from "@/lib/contactLink";
import { DEFAULT_QUALITY, QUALITIES, type Quality } from "@/lib/quality";
import { HANDOFF_KEY } from "@/components/PromptHero";
import OutOfCredits from "@/components/OutOfCredits";

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

const QUESTIONS = [
  ["What is free?", "The editor, the templates and the export, with no account and no watermark. Writing a site from a description is the one paid part: the first two are free, then five more are $20."],
  ["Where do my words and photographs go?", `To Anthropic, once, and only when you press Build my site. Photographs are reduced to ${LONG_EDGE} pixels on your device first. We do not store the description or the photographs.`],
  ["Can I change what it writes?", "Every word, in the editor. Nothing is published until you export the files and put them on a host yourself."],
];

const VIA: [ContactVia, string][] = [
  ["call", "Call"],
  ["whatsapp", "WhatsApp"],
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
  const [compact, setCompact] = useState(false);
  const [contact, setContact] = useState("");
  const [quality, setQuality] = useState<Quality>(DEFAULT_QUALITY);
  const [via, setVia] = useState<ContactVia>("call");
  const [images, setImages] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [buildFailed, setBuildFailed] = useState(false);
  const [needsCredits, setNeedsCredits] = useState(false);
  const [allowance, setAllowance] = useState<{
    hasKey: boolean;
    remaining: number;
    signedIn: boolean;
    canSignIn: boolean;
    canBuy: boolean;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Whatever was typed into the box on the landing page, so nobody writes it twice.
  useEffect(() => {
    try {
      const carried = sessionStorage.getItem(HANDOFF_KEY);
      if (carried) {
        sessionStorage.removeItem(HANDOFF_KEY);
        const narrow = window.innerWidth < 768;
        // Not set straight from the effect body: this is a read from an external store,
        // and the compiler's lint wants that arriving through a callback.
        queueMicrotask(() => {
          setDescription(carried.slice(0, MAX_DESCRIPTION));
          setCompact(narrow);
        });
      }
    } catch {
      // Storage refused: the box simply starts empty.
    }
  }, []);

  useEffect(() => {
    let live = true;
    fetch("/api/credits")
      .then((r) => r.json())
      .then((body: { hasKey?: boolean; remaining?: number; signedIn?: boolean; canSignIn?: boolean; canBuy?: boolean }) => {
        if (live) {
          setAllowance({
            hasKey: Boolean(body.hasKey),
            remaining: body.remaining ?? 0,
            signedIn: Boolean(body.signedIn),
            canSignIn: Boolean(body.canSignIn),
            canBuy: Boolean(body.canBuy),
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
    setBuildFailed(false);
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

  const phone = readPhone(contact);
  const link = contactLink(contact, via);

  const build = async () => {
    setBusy(true);
    setError("");
    setBuildFailed(true);
    setNeedsCredits(false);
    try {
      const result = await writeSite({
        description,
        images: images.map(({ media_type, data }) => ({ media_type, data })),
        contactHref: link,
        quality,
      });
      if (!result.ok) {
        setError(result.error);
        setNeedsCredits(result.needsCredits);
        return;
      }
      router.push("/editor");
    } finally {
      setBusy(false);
    }
  };

  const short = description.trim().length < 20;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="mx-auto max-w-2xl px-6 pb-24 pt-8 sm:pt-14 md:pt-20">
        <h1 className="lc-display text-3xl sm:text-4xl md:text-5xl">
          <span className="block">Describe the business.</span>
          <span className="block text-primary-ink">Get a site to edit.</span>
        </h1>
        <p className="mt-3 text-muted-foreground sm:mt-5">
          Claude, Anthropic&apos;s AI model, writes the first draft from what you type. Street
          names, hours and prices make a better site than adjectives do.
        </p>

        <label htmlFor="description" className="mt-6 block text-sm text-muted-foreground sm:mt-8">
          What is the business?
        </label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
          rows={compact ? 4 : 7}
          placeholder={EXAMPLES[0]}
          className={`mt-2 rounded-2xl border-white/10 bg-card px-4 py-3 text-base shadow-[var(--lift-1)] transition-shadow focus-visible:border-primary-ink/40 focus-visible:shadow-[var(--glow)] ${compact ? "field-sizing-fixed" : ""}`}
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

        <label htmlFor="contact" className="mt-5 block text-sm text-muted-foreground">
          How should customers reach you? (optional)
        </label>
        <Input
          id="contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          disabled={busy}
          maxLength={300}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby="contact-note"
          placeholder="Phone or WhatsApp number with country code, email, or a link"
          className="mt-2 h-11 rounded-2xl border-white/10 bg-card px-4 text-base shadow-[var(--lift-1)] transition-shadow focus-visible:border-primary-ink/40 focus-visible:shadow-[var(--glow)]"
        />
        {phone && (
          <div role="group" aria-label="What the buttons do with this number" className="mt-2 flex gap-2">
            {VIA.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={via === value}
                disabled={busy}
                onClick={() => setVia(value)}
                className={`lc-mono h-9 rounded-full border px-4 text-[0.8rem] transition-colors disabled:opacity-50 ${via === value ? "border-primary-ink/60 bg-primary-ink/15 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div id="contact-note" className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {contact.trim() && (
            <p>
              {link ? (
                <>
                  Buttons will open <span className="lc-mono break-all text-foreground">{link}</span>
                </>
              ) : phone && via === "whatsapp" ? (
                "WhatsApp needs the country code first, like +91 for India. Add it, or choose Call."
              ) : (
                "Buttons need a phone number, an email address or a link."
              )}
            </p>
          )}
          <p>Kept in this browser with the site; it is not sent to the model.</p>
        </div>

        <div role="group" aria-label="Quality" className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Quality</span>
          {(Object.keys(QUALITIES) as Quality[]).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={quality === value}
              disabled={busy}
              onClick={() => setQuality(value)}
              className={`lc-mono h-9 rounded-full border px-4 text-[0.8rem] transition-colors disabled:opacity-50 ${quality === value ? "border-primary-ink/60 bg-primary-ink/15 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"}`}
            >
              {QUALITIES[value].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Fast is quickest, Best takes longest and writes most carefully. Each uses one site.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={build} disabled={busy || short} size="lg" className="lc-btn-solid">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {busy ? "Writing your site…" : "Build my site"}
          </Button>
          {images.length < MAX_IMAGES && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                aria-hidden="true"
                tabIndex={-1}
                className="sr-only"
                onChange={(e) => {
                  void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                size="lg"
                onClick={() => fileRef.current?.click()}
                className="gap-1.5 border-dashed px-3 text-xs"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                Add photos (optional)
              </Button>
            </>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
          {busy ? QUALITIES[quality].wait : short ? "A sentence or two to start." : "You can change every word afterwards."}
        </p>

        {images.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
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
            <p className="text-xs text-muted-foreground">
              {images.length} of {MAX_IMAGES} photographs. They shape the words and the colours.
            </p>
          </div>
        )}

        {error && needsCredits && (
          <OutOfCredits
            message={error}
            canSignIn={Boolean(allowance?.canSignIn)}
            signedIn={Boolean(allowance?.signedIn)}
            canBuy={Boolean(allowance?.canBuy)}
          />
        )}
        {error && !needsCredits && (
          <div role="alert" className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground">
            <p>{error}</p>
            {buildFailed && (
              <p className="mt-2">
                <Link href="/templates" className="underline underline-offset-4">
                  Every template is free to edit and export meanwhile
                </Link>
                .
              </p>
            )}
          </div>
        )}

        <ol className="mt-12 grid gap-5 border-y border-border py-7 sm:grid-cols-3">
          {WHAT_HAPPENS.map(([title, detail]) => (
            <li key={title}>
              <p className="text-sm text-foreground">{title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{detail}</p>
            </li>
          ))}
        </ol>

        <dl className="mt-10 grid gap-6">
          {QUESTIONS.map(([question, answer]) => (
            <div key={question}>
              <dt className="text-sm text-foreground">{question}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{answer}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 text-sm text-muted-foreground">
          {allowance?.hasKey ? (
            <>
              {allowance.remaining} {allowance.remaining === 1 ? "site" : "sites"} left{" "}
              {allowance.signedIn ? "on your account" : "on this browser"}.{" "}
              <Link href="/pricing" className="underline underline-offset-4">Top up</Link>
            </>
          ) : (
            <>
              The first two sites are free. Five more are $20.{" "}
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
