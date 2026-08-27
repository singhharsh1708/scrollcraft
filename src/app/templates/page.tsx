"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowRight, Search, Layers, Eye } from "lucide-react";
import Navbar from "@/components/Navbar";
import StylePreview from "@/components/StylePreview";
import { TEMPLATES, templateCategories, templateScrollHeight, templateSectionCount } from "@/lib/templates";
import SiteFooter from "@/components/SiteFooter";

export default function TemplatesPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  // Only the hovered card animates — sixteen concurrent canvases is not free.
  const [hovered, setHovered] = useState<string | null>(null);

  const categories = useMemo(() => ["All", ...templateCategories()], []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TEMPLATES.filter((t) => {
      const matchesCategory = activeCategory === "All" || t.category === activeCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.tagline.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [search, activeCategory]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="pt-16 pb-10 text-center px-6">
        <Badge variant="outline" className="mb-5 border-primary/40 text-primary-ink bg-primary/10 px-4 py-1.5">
          <Layers className="w-3 h-3 mr-1.5" /> {TEMPLATES.length} templates, all free
        </Badge>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-4">
          Start from a finished site
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Every template ships with its own palette, typography, pacing and copy structure.
          Open one, change the words, export it.
        </p>
      </section>

      <div className="px-6 pb-8 max-w-7xl mx-auto space-y-4">
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="template-search" className="sr-only">Search templates</label>
          <Input
            id="template-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, category or tag"
            className="pl-9 bg-card border-white/10"
          />
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              aria-pressed={activeCategory === c}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeCategory === c
                  ? "border-primary/50 bg-primary/15 text-primary-ink"
                  : "border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground" aria-live="polite">
          {filtered.length} of {TEMPLATES.length} templates
        </p>
      </div>

      <section className="px-6 pb-24 max-w-7xl mx-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-20 border border-white/8 rounded-2xl bg-card">
            <p className="font-medium mb-1">Nothing matches “{search}”</p>
            <p className="text-sm text-muted-foreground mb-5">
              Try a category instead, or clear the search.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-white/10"
              onClick={() => { setSearch(""); setActiveCategory("All"); }}
            >
              Show all templates
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((t) => (
              <article
                key={t.slug}
                onMouseEnter={() => setHovered(t.slug)}
                onMouseLeave={() => setHovered((h) => (h === t.slug ? null : h))}
                className="group rounded-2xl border border-white/8 bg-card overflow-hidden flex flex-col focus-within:border-primary/40 hover:border-white/15 transition-colors"
              >
                <div className={`relative aspect-[16/10] bg-gradient-to-br ${t.gradient}`}>
                  <StylePreview
                    style={t.style}
                    colors={t.colors}
                    paused={hovered !== t.slug}
                    className="absolute inset-0 w-full h-full"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                    <span className="text-[10px] uppercase tracking-widest text-white/70">{t.category}</span>
                  </div>
                </div>

                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div className="space-y-1">
                    <h2 className="font-bold tracking-tight">{t.name}</h2>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t.tagline}</p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {t.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <p className="text-[11px] text-muted-foreground mt-auto">
                    {templateSectionCount(t)} sections ·{" "}
                    {templateScrollHeight(t).toLocaleString()}px of scroll
                  </p>

                  <div className="flex gap-2">
                    <Link href={`/templates/${t.slug}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full border-white/10 text-xs h-8 gap-1.5">
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </Button>
                    </Link>
                    <Link href={`/editor?template=${t.slug}`} className="flex-1">
                      <Button size="sm" className="w-full text-xs h-8 gap-1.5">
                        Use <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <SiteFooter compact />
    </main>
  );
}
