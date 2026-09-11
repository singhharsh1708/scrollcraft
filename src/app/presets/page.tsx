"use client";
import { useState } from "react";
import Link from "next/link";
import { TEMPLATES } from "@/lib/templates";
import { Button } from "@/components/ui/button";
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((preset) => (
              <div
                key={preset.name}
                className="group relative rounded-lg border border-border overflow-hidden hover:border-foreground/25 transition-all hover:-translate-y-1 cursor-pointer"
                onMouseEnter={() => setHovered(preset.name)}
                onMouseLeave={() => setHovered((h) => (h === preset.name ? null : h))}
              >
                {/* Visual preview — the actual renderer, so the card shows what this
                    preset really generates. Only the hovered card animates. */}
                <div className="aspect-video relative flex items-end p-4 bg-black">
                  <StylePreview
                    style={preset.style}
                    colors={preset.colors}
                    paused={hovered !== preset.name}
                    className="absolute inset-0 w-full h-full"
                  />
                  {/* Scrim keeps the tag row and name legible over any frame */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="relative z-10">
                    <div className="flex flex-wrap gap-1 mb-2">
                      {preset.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="lc-mono text-[11px] px-2 py-0.5 rounded bg-black/40 backdrop-blur-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="text-base font-medium text-white leading-tight">{preset.name}</p>
                    <p className="text-xs text-white/60">{preset.category}</p>
                  </div>
                  {/* Hover overlay — z-20 keeps it above the tags row (z-10) */}
                  <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 opacity-100 [@media(hover:hover)]:opacity-0 group-hover:[@media(hover:hover)]:opacity-100 group-focus-within:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm">
                    <Link href={`/create?template=${encodeURIComponent(preset.name)}`}>
                      <Button size="sm" className="lc-mono bg-primary text-white text-xs h-9 px-3">
                        Use preset <ArrowRight className="ml-1 w-3 h-3" />
                      </Button>
                    </Link>
                    {(() => {
                      // Only offer a walkthrough where a real one exists. The rest previewed
                      // themselves by linking to /create, which is not a preview — the card's
                      // own animation now fills that role.
                      const demoSlug = TEMPLATES.find(
                        (d) => d.name.toLowerCase() === preset.name.toLowerCase()
                      )?.slug;
                      if (!demoSlug) return null;
                      return (
                        <Link href={`/templates/${demoSlug}`}>
                          <Button size="sm" variant="outline" className="lc-mono border-white/25 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-xs h-9 px-3">
                            <Eye className="w-3 h-3 mr-1" /> Preview
                          </Button>
                        </Link>
                      );
                    })()}
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 bg-card">
                  <p className="font-medium text-sm mb-0.5">{preset.name}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{preset.description}</p>
                </div>
              </div>
            ))}
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
