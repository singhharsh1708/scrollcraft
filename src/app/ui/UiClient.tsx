"use client";
import { useMemo, useState } from "react";
import { Check, Copy, Monitor, Smartphone, Tablet } from "lucide-react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { Input } from "@/components/ui/input";
import type { KitComponent } from "@/lib/componentKit";

/**
 * The page the kit is actually used from.
 *
 * Each preview is an iframe of the page that block would make on its own, so what is on
 * screen is what the copy button hands over, down to the stylesheet. Rendering it inline
 * would let this site's CSS reach into the preview and show somebody a block that behaves
 * differently once pasted.
 */

const WIDTHS = {
  Phone: 390,
  Tablet: 768,
  Desktop: 1180,
} as const;
type WidthName = keyof typeof WIDTHS;

const ICONS: Record<WidthName, typeof Monitor> = { Phone: Smartphone, Tablet: Tablet, Desktop: Monitor };

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // A browser that refuses the clipboard still lets someone select the code.
          return;
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="lc-mono inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-foreground hover:border-foreground/40"
    >
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export default function UiClient({
  components,
  tokens,
  lightTokens,
  base,
  pageFor,
}: {
  components: KitComponent[];
  tokens: string;
  lightTokens: string;
  base: string;
  /** The exact document each preview shows, built on the server from the same registry. */
  pageFor: Record<string, { dark: string; light: string }>;
}) {
  const [query, setQuery] = useState("");
  const [width, setWidth] = useState<WidthName>("Desktop");
  const [light, setLight] = useState(false);
  const [tab, setTab] = useState<Record<string, "html" | "css">>({});

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return components;
    return components.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.description.toLowerCase().includes(needle) || c.id.includes(needle)
    );
  }, [components, query]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="px-6 pb-10 pt-20 text-center">
        <p className="lc-mono mb-6 text-sm text-primary-ink">{components.length} sections, nothing to install</p>
        <h1 className="lc-display text-5xl md:text-6xl lg:text-7xl">
          <span className="block">Copy a section,</span>
          <span className="block text-primary-ink">paste it anywhere</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Plain HTML and CSS. No React, no Tailwind, no build step. These work in a static folder,
          a WordPress block or a PHP template, and they read your page&apos;s own colours where you have them.
        </p>
      </section>

      <div className="mx-auto max-w-5xl space-y-4 px-6 pb-10">
        <div className="relative mx-auto max-w-md">
          <label htmlFor="kit-search" className="sr-only">Search sections</label>
          <Input
            id="kit-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sections"
            className="lc-mono h-11 bg-card"
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5" role="group" aria-label="Preview width">
            {(Object.keys(WIDTHS) as WidthName[]).map((name) => {
              const Icon = ICONS[name];
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setWidth(name)}
                  aria-pressed={width === name}
                  className={`lc-mono inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs transition-colors ${
                    width === name ? "bg-primary-ink/15 text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {name}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setLight((v) => !v)}
            aria-pressed={light}
            className="lc-mono h-9 rounded-md border border-border px-3 text-xs text-foreground hover:border-foreground/40"
          >
            {light ? "On a light page" : "On a dark page"}
          </button>
          <CopyButton text={light ? lightTokens : tokens} label="Copy the tokens" />
          <CopyButton text={base} label="Copy the shared CSS" />
        </div>

        <p className="lc-mono text-center text-xs text-muted-foreground" aria-live="polite">
          {shown.length} of {components.length} sections
        </p>
      </div>

      <section className="mx-auto max-w-5xl space-y-12 px-6 pb-24">
        {shown.map((c) => {
          const active = tab[c.id] ?? "html";
          const code = active === "html" ? c.html : c.css;
          return (
            <article key={c.id} id={c.id} className="rounded-lg border border-border bg-card">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
                <div>
                  <h2 className="text-xl font-medium">{c.name}</h2>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">{c.description}</p>
                </div>
                <CopyButton text={active === "html" ? c.html : c.css} label={`Copy ${active.toUpperCase()}`} />
              </header>

              <div className="flex justify-center bg-background/60 p-4">
                <iframe
                  title={`${c.name} preview`}
                  srcDoc={light ? pageFor[c.id].light : pageFor[c.id].dark}
                  loading="lazy"
                  style={{ width: WIDTHS[width], maxWidth: "100%", height: 420, border: 0, borderRadius: 8, background: "#fff" }}
                />
              </div>

              <div className="border-t border-border">
                <div className="flex gap-1 border-b border-border px-3 pt-3" role="tablist" aria-label={`${c.name} code`}>
                  {(["html", "css"] as const).map((name) => (
                    <button
                      key={name}
                      type="button"
                      role="tab"
                      aria-selected={active === name}
                      onClick={() => setTab((t) => ({ ...t, [c.id]: name }))}
                      className={`lc-mono rounded-t-md px-3 py-2 text-xs transition-colors ${
                        active === name ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {name.toUpperCase()}
                    </button>
                  ))}
                </div>
                <pre className="max-h-80 overflow-auto bg-background p-4 text-xs leading-relaxed text-foreground">
                  <code>{code}</code>
                </pre>
              </div>
            </article>
          );
        })}

        {shown.length === 0 && (
          <p className="rounded-lg border border-border bg-card p-10 text-center text-muted-foreground">
            No section matches that. Clear the search to see all {components.length}.
          </p>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
