"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowRight, Search, Sparkles, Eye } from "lucide-react";

const CATEGORIES = ["All", "SaaS", "Agency", "E-commerce", "Mobile App", "Startup", "Developer Tool", "AI Platform", "Fintech", "Logistics"];

const PRESETS = [
  {
    name: "Meridian",
    category: "Agency",
    description: "Premium agency portfolio with bold editorial scroll",
    tags: ["Dark", "Minimal", "Editorial"],
    gradient: "from-slate-900 via-slate-800 to-black",
    accent: "#e2e8f0",
    prompt: "A slow cinematic pan through a modernist architecture interior. Concrete and glass. Dark, premium, editorial feel. Shallow depth of field.",
  },
  {
    name: "TripVault",
    category: "Mobile App",
    description: "Travel app showcase with destination flythrough",
    tags: ["Colorful", "Immersive", "3D"],
    gradient: "from-sky-900 via-blue-900 to-indigo-950",
    accent: "#38bdf8",
    prompt: "Aerial cinematic flyover of turquoise tropical coastline at golden hour. Drone shot, warm colors, crystal water, lush green islands.",
  },
  {
    name: "Shopnest",
    category: "E-commerce",
    description: "Luxury e-commerce with product reveal scroll",
    tags: ["Luxury", "Dark", "Product"],
    gradient: "from-amber-950 via-yellow-950 to-black",
    accent: "#f59e0b",
    prompt: "Ultra slow macro product shot. Luxury leather texture in dramatic studio lighting. Black background, golden rim light. Commercial photography.",
  },
  {
    name: "OrbitCRM",
    category: "SaaS",
    description: "Dark SaaS hero with floating UI elements",
    tags: ["SaaS", "Dark", "Tech"],
    gradient: "from-violet-950 via-purple-950 to-black",
    accent: "#a78bfa",
    prompt: "Cinematic flythrough of a dark futuristic digital dashboard. Glowing UI panels float in dark space. Purple and blue neon accents. Depth of field blur.",
  },
  {
    name: "SyncBase",
    category: "SaaS",
    description: "Productivity tool with clean minimal scroll",
    tags: ["Minimal", "Clean", "Productivity"],
    gradient: "from-emerald-950 via-teal-950 to-black",
    accent: "#34d399",
    prompt: "Abstract flowing data streams in deep space. Green and teal particle effects moving through darkness. Clean, technical, modern.",
  },
  {
    name: "StackForge",
    category: "Developer Tool",
    description: "Dev tool landing with code-aesthetic depth",
    tags: ["Developer", "Dark", "Code"],
    gradient: "from-gray-900 via-zinc-900 to-black",
    accent: "#22d3ee",
    prompt: "Cinematic zoom through lines of glowing code on dark screens. Matrix-like but premium. Cyan and white light trails. Depth of field.",
  },
  {
    name: "VisionForge",
    category: "AI Platform",
    description: "AI platform hero with neural network visuals",
    tags: ["AI", "Futuristic", "Dark"],
    gradient: "from-fuchsia-950 via-pink-950 to-black",
    accent: "#e879f9",
    prompt: "Abstract neural network visualization. Glowing nodes and connections in deep purple space. Data flowing between points. Ultra cinematic.",
  },
  {
    name: "Halo",
    category: "Fintech",
    description: "Fintech stablecoin landing with premium feel",
    tags: ["Finance", "Premium", "Dark"],
    gradient: "from-blue-950 via-indigo-950 to-black",
    accent: "#60a5fa",
    prompt: "Abstract liquid metal surface with ripples. Futuristic financial data overlays. Dark blue, silver, premium. Cinematic macro shot.",
  },
  {
    name: "Targo",
    category: "Logistics",
    description: "Transport & logistics with bold red branding",
    tags: ["Bold", "Red", "Dynamic"],
    gradient: "from-red-950 via-rose-950 to-black",
    accent: "#f87171",
    prompt: "Time-lapse of cargo ships and trucks moving at dusk. Bold industrial aesthetic. Red sky, motion blur, cinematic grade.",
  },
  {
    name: "Mindloop",
    category: "Startup",
    description: "Newsletter / content platform with liquid-glass UI",
    tags: ["Glass", "Minimal", "Mono"],
    gradient: "from-neutral-900 via-zinc-900 to-black",
    accent: "#a3a3a3",
    prompt: "Slow motion liquid glass surface with subtle refractions. Monochrome. Ultra minimal. Premium material render. Studio lighting.",
  },
  {
    name: "Power AI",
    category: "AI Platform",
    description: "Full-screen dark video hero with AI gradient",
    tags: ["AI", "Dark", "Bold"],
    gradient: "from-indigo-950 via-violet-950 to-black",
    accent: "#818cf8",
    prompt: "Abstract AI energy field. Electric indigo and violet light bursts in dark space. Powerful, dynamic, cinematic. Slow motion.",
  },
  {
    name: "AutoMachines",
    category: "Developer Tool",
    description: "Automation hero with Spline 3D aesthetic",
    tags: ["3D", "Dark", "Automation"],
    gradient: "from-stone-900 via-neutral-900 to-black",
    accent: "#d4d4d4",
    prompt: "Cinematic shot of robotic assembly arms in dark factory. Sparks flying, precision motion. Industrial but premium. Slow motion.",
  },
];

export default function PresetsPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

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
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight">ScrollCraft</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/presets" className="text-sm text-foreground font-medium">Presets</Link>
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/create">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">Start Building</Button>
          </Link>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-16 pb-10 text-center px-6">
        <Badge variant="outline" className="mb-5 border-primary/40 text-primary bg-primary/10 px-4 py-1.5">
          <Sparkles className="w-3 h-3 mr-1.5" /> Production-ready presets
        </Badge>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-4">
          Start from a preset
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Every preset comes with a pre-built AI prompt, scroll layout, and section structure. Customize in seconds.
        </p>
      </section>

      {/* Search + filters */}
      <div className="px-6 pb-8 max-w-6xl mx-auto space-y-4">
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search presets..."
            className="pl-9 bg-card border-white/10 focus:border-primary/50"
          />
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                activeCategory === cat
                  ? "bg-primary text-white border-primary"
                  : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <section className="px-6 pb-24 max-w-6xl mx-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">No presets found</p>
            <p className="text-sm mt-1">Try a different search or category</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((preset) => (
              <div
                key={preset.name}
                className="group relative rounded-2xl border border-white/8 overflow-hidden hover:border-white/20 transition-all hover:-translate-y-1"
              >
                {/* Visual preview */}
                <div className={`aspect-video bg-gradient-to-br ${preset.gradient} relative flex items-end p-5`}>
                  {/* Fake scroll lines to suggest 3D scroll */}
                  <div className="absolute inset-0 opacity-10">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-t border-white"
                        style={{ top: `${20 + i * 15}%`, opacity: 1 - i * 0.15 }}
                      />
                    ))}
                  </div>
                  {/* Accent glow */}
                  <div
                    className="absolute inset-0 opacity-20 blur-3xl"
                    style={{ background: `radial-gradient(circle at 50% 50%, ${preset.accent}, transparent 70%)` }}
                  />
                  <div className="relative z-10">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {preset.tags.map((tag) => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-sm font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="font-bold text-lg text-white">{preset.name}</p>
                    <p className="text-sm text-white/60">{preset.category}</p>
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 backdrop-blur-sm">
                    <Link href={`/create?template=${encodeURIComponent(preset.name)}&prompt=${encodeURIComponent(preset.prompt)}`}>
                      <Button size="sm" className="bg-primary text-white shadow-lg shadow-primary/30">
                        Use preset <ArrowRight className="ml-1 w-3 h-3" />
                      </Button>
                    </Link>
                    <Link href={`/editor?prompt=${encodeURIComponent(preset.prompt)}`}>
                      <Button size="sm" variant="outline" className="border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20">
                        <Eye className="w-3 h-3 mr-1" /> Preview
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 bg-card">
                  <p className="font-semibold text-sm mb-1">{preset.name}</p>
                  <p className="text-xs text-muted-foreground">{preset.description}</p>
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
          Start from scratch with a custom prompt — describe any atmosphere and our AI will generate it.
        </p>
        <Link href="/create">
          <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-10 py-6 text-base font-semibold shadow-xl shadow-primary/30">
            Create from scratch <Sparkles className="ml-2 w-4 h-4" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/5 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-primary" />
          </div>
          ScrollCraft — Built with Next.js & AI
        </div>
      </footer>
    </main>
  );
}
