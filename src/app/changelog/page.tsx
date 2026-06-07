import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

const ENTRIES = [
  {
    version: "v0.3.0",
    date: "June 7, 2026",
    tag: "Major",
    tagColor: "bg-primary/15 text-primary border-primary/30",
    changes: [
      { type: "new", text: "Pricing page with monthly/annual toggle and 5 tiers" },
      { type: "new", text: "Presets gallery — 12 production-ready templates with search & category filters" },
      { type: "new", text: "Full landing page — pipeline steps, testimonials, FAQ, footer" },
      { type: "new", text: "Dashboard — manage sites, credits, quick actions" },
      { type: "new", text: "Auth — sign in with GitHub or Google" },
      { type: "new", text: "About, Contact, and Changelog pages" },
      { type: "new", text: "Chat-based AI editing in the editor" },
      { type: "improved", text: "Nav updated across all pages with Presets & Pricing links" },
    ],
  },
  {
    version: "v0.2.0",
    date: "June 5, 2026",
    tag: "Launch",
    tagColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    changes: [
      { type: "new", text: "Initial public launch on Vercel" },
      { type: "new", text: "Canvas-based ScrollEngine — 400+ frames, native browser scroll" },
      { type: "new", text: "/create — 3-step flow: prompt → configure → generate" },
      { type: "new", text: "/editor — full visual editor with sections, style, layout controls" },
      { type: "new", text: "AI video generation API — Luma AI + Runway ML with demo fallback" },
      { type: "new", text: "FFmpeg frame extraction API — file upload + URL" },
      { type: "new", text: "JSZip export to standalone HTML/CSS/JS bundle" },
      { type: "new", text: "Demo mode with SVG gradient frames (no API key needed)" },
    ],
  },
  {
    version: "v0.1.0",
    date: "June 1, 2026",
    tag: "Internal",
    tagColor: "bg-white/8 text-muted-foreground border-white/10",
    changes: [
      { type: "new", text: "Project scaffolded with Next.js 16, TypeScript, Tailwind, shadcn/ui" },
      { type: "new", text: "Dark purple theme established" },
      { type: "new", text: "Repository created and connected to Vercel" },
    ],
  },
];

const TYPE_STYLES: Record<string, string> = {
  new: "bg-primary/10 text-primary",
  improved: "bg-blue-500/10 text-blue-400",
  fixed: "bg-emerald-500/10 text-emerald-400",
  removed: "bg-red-500/10 text-red-400",
};

export default function ChangelogPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight">ScrollCraft</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/presets" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Presets</Link>
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/create"><Button size="sm" className="bg-primary hover:bg-primary/90 text-white">Start Building</Button></Link>
        </div>
      </nav>

      <section className="pt-20 pb-8 text-center px-6">
        <Badge variant="outline" className="mb-5 border-primary/40 text-primary bg-primary/10 px-4 py-1.5">
          What&apos;s new
        </Badge>
        <h1 className="text-5xl font-black tracking-tighter mb-4">Changelog</h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Every update, every improvement — logged here.
        </p>
      </section>

      <section className="px-6 pb-24 max-w-2xl mx-auto">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[7px] top-4 bottom-4 w-px bg-white/8" />

          <div className="space-y-12">
            {ENTRIES.map((entry, i) => (
              <div key={entry.version} className="relative pl-8">
                {/* Dot */}
                <div className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-background ${i === 0 ? "bg-primary" : "bg-white/20"}`} />

                <div className="space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-lg font-black tracking-tight">{entry.version}</h2>
                    <Badge variant="outline" className={`text-xs px-2 py-0.5 border ${entry.tagColor}`}>{entry.tag}</Badge>
                    <span className="text-xs text-muted-foreground">{entry.date}</span>
                  </div>

                  <div className="space-y-2">
                    {entry.changes.map((c, j) => (
                      <div key={j} className="flex items-start gap-2.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 mt-0.5 ${TYPE_STYLES[c.type] || TYPE_STYLES.new}`}>
                          {c.type}
                        </span>
                        <p className="text-sm text-muted-foreground leading-relaxed">{c.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
