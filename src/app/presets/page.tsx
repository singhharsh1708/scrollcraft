"use client";
import { useState } from "react";
import Link from "next/link";
import { TEMPLATES } from "@/lib/templates";
import { Input } from "@/components/ui/input";
import { ArrowRight, Search, Eye } from "lucide-react";
import Navbar from "@/components/Navbar";
import StylePreview from "@/components/StylePreview";
import { PRESETS } from "@/lib/presets";
import SiteFooter from "@/components/SiteFooter";

const CATEGORIES = [
  "All", "SaaS", "Agency", "E-commerce", "Mobile App", "Startup",
  "Developer Tool", "AI Platform", "Fintech", "Logistics",
  "Healthcare", "Education", "Gaming", "Real Estate", "Restaurant",
  "Creative", "Music", "Fitness",
];


export default function PresetsPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  // Only the hovered card runs its animation loop — 57 concurrent canvases would not be free.
  const [hovered, setHovered] = useState<string | null>(null);

  const filtered = PRESETS.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <Navbar />

      {/* Header */}
      <section className="px-6 pb-12 pt-20 text-center">
        <p className="lc-mono mb-6 text-sm text-primary-ink">{PRESETS.length} styles and palettes</p>
        <h1 className="lc-display text-5xl md:text-6xl lg:text-7xl">
          <span className="block">Start from</span>
          <span className="block text-primary-ink">a preset</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Every preset carries a style and palette. For finished sites with copy, browse the templates.
        </p>
      </section>

      {/* Search + filters */}
      <div className="px-6 pb-8 max-w-7xl mx-auto space-y-4">
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="preset-search" className="sr-only">Search presets</label>
          <Input
            id="preset-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search presets…"
            className="lc-mono h-11 pl-9 bg-card border-border focus:border-primary-ink/50"
          />
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              aria-pressed={activeCategory === cat}
              className={`lc-mono h-9 px-4 rounded-full text-[0.8rem] border transition-colors cursor-pointer ${
                activeCategory === cat
                  ? "border-primary-ink/60 bg-primary-ink/15 text-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <p className="lc-mono text-center text-xs text-muted-foreground">
          {filtered.length} preset{filtered.length !== 1 ? "s" : ""}
          {activeCategory !== "All" ? ` in ${activeCategory}` : ""}
          {search ? ` matching "${search}"` : ""}
        </p>
      </div>

      {/* Grid */}
      <section className="px-6 pb-24 max-w-7xl mx-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">No presets found</p>
            <p className="text-sm mt-1">Try a different search or category</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((preset) => {
              // Only offer a walkthrough where a real one exists.
              const demoSlug = TEMPLATES.find((d) => d.name.toLowerCase() === preset.name.toLowerCase())?.slug;
              return (
                <article
                  key={preset.name}
                  className="flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-foreground/25"
                  onMouseEnter={() => setHovered(preset.name)}
                  onMouseLeave={() => setHovered((h) => (h === preset.name ? null : h))}
                >
                  {/* The renderer itself, so the card shows what this preset generates.
                      The particle and geometric styles are near black with small points of
                      colour, so the frame names itself and shows its palette rather than
                      leaving a visitor to read an unlit rectangle. */}
                  <div className="relative aspect-video overflow-hidden bg-black">
                    <StylePreview
                      style={preset.style}
                      colors={preset.colors}
                      paused={hovered !== preset.name}
                      className="absolute inset-0 h-full w-full"
                    />
                    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                    <div aria-hidden="true" className="absolute right-3 top-3 flex gap-1.5">
                      {preset.colors.map((c, i) => (
                        <span key={i} className="h-3 w-3 rounded-full ring-1 ring-white/25" style={{ background: c }} />
                      ))}
                    </div>
                    <div className="absolute inset-x-4 bottom-4">
                      <p className="lc-mono text-xs text-white/70">{preset.category}</p>
                      <h2 className="lc-display mt-0.5 text-xl text-white">{preset.name}</h2>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <p className="text-sm leading-snug text-muted-foreground">{preset.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {preset.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="lc-mono rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-auto flex items-center gap-5">
                      <Link
                        href={`/create?template=${encodeURIComponent(preset.name)}`}
                        className="lc-mono inline-flex h-9 items-center gap-1.5 text-sm text-primary-ink hover:underline"
                      >
                        Use preset <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                      {demoSlug && (
                        <Link
                          href={`/templates/${demoSlug}`}
                          className="lc-mono inline-flex h-9 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Preview
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-border px-6 pb-28 pt-24 text-center">
        <h2 className="lc-display text-4xl sm:text-5xl">
          <span className="block">Don&apos;t see</span>
          <span className="block text-primary-ink">what you need?</span>
        </h2>
        <p className="mx-auto mb-10 mt-6 max-w-md text-lg text-muted-foreground">
          Start from scratch: pick a style and a palette, or bring your own video, and the frames render in your browser.
        </p>
        <Link href="/create" className="lc-btn lc-btn-solid">
          Create from scratch <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      <SiteFooter />
    </main>
  );
}
