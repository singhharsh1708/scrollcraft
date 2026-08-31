"use client";
import { useState } from "react";
import Link from "next/link";
import { TEMPLATES } from "@/lib/templates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowRight, Search, Sparkles, Eye } from "lucide-react";
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
      <section className="pt-16 pb-10 text-center px-6">
        <Badge variant="outline" className="mb-5 border-primary/40 text-primary-ink bg-primary/10 px-4 py-1.5">
          <Sparkles className="w-3 h-3 mr-1.5" /> {PRESETS.length} production-ready presets
        </Badge>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-4">
          Start from a preset
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
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
            className="pl-9 bg-card border-white/10 focus:border-primary/50"
          />
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                activeCategory === cat
                  ? "bg-primary text-white border-primary"
                  : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
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
                className="group relative rounded-2xl border border-white/8 overflow-hidden hover:border-white/20 transition-all hover:-translate-y-1 cursor-pointer"
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
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-sm font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="font-bold text-base text-white leading-tight">{preset.name}</p>
                    <p className="text-xs text-white/60">{preset.category}</p>
                  </div>
                  {/* Hover overlay — z-20 keeps it above the tags row (z-10) */}
                  <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 opacity-100 [@media(hover:hover)]:opacity-0 group-hover:[@media(hover:hover)]:opacity-100 group-focus-within:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm">
                    <Link href={`/create?template=${encodeURIComponent(preset.name)}`}>
                      <Button size="sm" className="bg-primary text-white shadow-lg shadow-primary/30 text-xs h-8 px-3">
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
                          <Button size="sm" variant="outline" className="border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-xs h-8 px-3">
                            <Eye className="w-3 h-3 mr-1" /> Preview
                          </Button>
                        </Link>
                      );
                    })()}
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 bg-card">
                  <p className="font-semibold text-sm mb-0.5">{preset.name}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{preset.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bottom CTA */}
      <section className="pb-24 px-6 text-center border-t border-white/5 pt-20">
        <h2 className="text-3xl font-black tracking-tighter mb-4">Don&apos;t see what you need?</h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Start from scratch — pick a style and a palette, or bring your own video, and the frames render in your browser.
        </p>
        <Link href="/create">
          <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-10 py-6 text-base font-semibold shadow-xl shadow-primary/30">
            Create from scratch <Sparkles className="ml-2 w-4 h-4" />
          </Button>
        </Link>
      </section>

      <SiteFooter compact />
    </main>
  );
}
