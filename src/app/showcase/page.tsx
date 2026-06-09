"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, Play } from "lucide-react";
import { DEMO_SITES } from "@/lib/demoSites";

export default function ShowcasePage() {
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
          <Link href="/showcase" className="text-sm text-foreground font-medium">Examples</Link>
          <Link href="/presets" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Presets</Link>
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/create">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">Start Building</Button>
          </Link>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-16 pb-12 text-center px-6">
        <Badge variant="outline" className="mb-5 border-primary/40 text-primary bg-primary/10 px-4 py-1.5">
          <Play className="w-3 h-3 mr-1.5" /> Live working demos
        </Badge>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-4">
          See ScrollCraft in action
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Real websites built with ScrollCraft — fully interactive scroll animations, live in your browser. Click any to experience it.
        </p>
      </section>

      {/* Demo grid */}
      <section className="px-6 pb-24 max-w-6xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {DEMO_SITES.map((demo) => (
            <Link
              key={demo.slug}
              href={`/demos/${demo.slug}`}
              className="group block rounded-2xl border border-white/8 overflow-hidden hover:border-white/25 transition-all hover:-translate-y-1 hover:shadow-2xl"
            >
              {/* Preview thumbnail */}
              <div className={`aspect-video bg-gradient-to-br ${demo.gradient} relative overflow-hidden`}>
                {/* Animated glow */}
                <div
                  className="absolute inset-0 blur-2xl animate-pulse"
                  style={{
                    background: `radial-gradient(circle at 40% 40%, ${demo.accentColor}55, transparent 65%)`,
                    animationDuration: "3s",
                  }}
                />
                <div
                  className="absolute inset-0 blur-3xl"
                  style={{
                    background: `radial-gradient(circle at 70% 65%, ${demo.accentColor}33, transparent 60%)`,
                  }}
                />
                {/* Fake section lines */}
                <div className="absolute inset-0 flex flex-col justify-end p-5 gap-2">
                  <div className="h-2 rounded-full bg-white/20 w-24" />
                  <div className="h-5 rounded-full bg-white/60 w-48" />
                  <div className="h-2.5 rounded-full bg-white/25 w-40" />
                  <div className="mt-2 h-8 rounded-lg bg-white/20 w-28 border border-white/30" />
                </div>
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 backdrop-blur-[2px]">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center border border-white/30 backdrop-blur-sm"
                    style={{ background: `${demo.accentColor}33` }}
                  >
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-4 bg-card flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm">{demo.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/8 text-muted-foreground border border-white/10">
                      {demo.category}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{demo.tagline}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 ml-3" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24 px-6 text-center border-t border-white/5 pt-20">
        <h2 className="text-3xl font-black tracking-tighter mb-4">Ready to build yours?</h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Every demo above was built in under 2 minutes with ScrollCraft. Start from a preset or describe your own.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/create">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-8 py-5 text-sm font-semibold shadow-xl shadow-primary/30">
              Start building free <Sparkles className="ml-2 w-4 h-4" />
            </Button>
          </Link>
          <Link href="/presets">
            <Button size="lg" variant="outline" className="border-white/15 px-8 py-5 text-sm">
              Browse 50 presets <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

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
