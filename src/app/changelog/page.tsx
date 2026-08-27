import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

const ENTRIES = [
  {
    version: "v1.0.0",
    date: "August 27, 2026",
    tag: "Major",
    tagColor: "bg-primary/15 text-primary-ink border-primary/30",
    changes: [
      { type: "new", text: "Fully open source and free. No accounts, no database, no payment of any kind" },
      { type: "new", text: "Runs with an empty environment: clone it, npm install, npm run dev. Nothing to configure" },
      { type: "new", text: "Video frames are extracted in your browser — your footage never leaves the device" },
      { type: "new", text: "Exports ship a 404 page, favicon, social card, robots.txt and configs for Netlify, Vercel, GitHub Pages and Cloudflare" },
      { type: "improved", text: "All 21 templates are free; the 8 that were sold individually are no longer gated" },
      { type: "removed", text: "Sign-in, the dashboard, saved sites and hosted /s/ links — the tool keeps your work in your own browser and exports it" },
      { type: "removed", text: "Razorpay, Lemon Squeezy, subscription plans and premium template purchases" },
      { type: "fixed", text: "Procedurally exported sites rendered a black screen: the background recipe was emitted in the wrong shape and threw on first paint" },
    ],
  },
  {
    version: "v0.5.0",
    date: "August 26, 2026",
    tag: "Major",
    tagColor: "bg-primary/15 text-primary-ink border-primary/30",
    changes: [
      { type: "new", text: "Publish — every site gets a hosted link at /s/your-site, one button from the dashboard" },
      { type: "new", text: "Template library — 21 finished sites across 11 categories, free on every plan" },
      { type: "new", text: "Templates carry real typography: Google Fonts pairings, type scales, and palettes that survive into the export" },
      { type: "improved", text: "One browse surface — showcase and demos folded into /templates" },
      { type: "fixed", text: "Scroll scrubbing finished early on tall viewports; the sequence now maps to the page's real height" },
    ],
  },
  {
    version: "v0.4.0",
    date: "August 26, 2026",
    tag: "Major",
    tagColor: "bg-primary/15 text-primary-ink border-primary/30",
    changes: [
      { type: "new", text: "Every template is free on every plan, including the free one" },
      { type: "improved", text: "Paid plans now differ only by how many websites you keep saved, and that limit is enforced" },
      { type: "removed", text: "AI chat editing and AI video generation — the product is a template library now" },
      { type: "removed", text: "AI credits, which nothing consumed" },
      { type: "fixed", text: "First-time sign-up through GitHub or Google, which failed for every new account" },
    ],
  },
  {
    version: "v0.3.0",
    date: "June 7, 2026",
    tag: "Major",
    tagColor: "bg-primary/15 text-primary-ink border-primary/30",
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
      { type: "new", text: "Canvas-based ScrollEngine — up to 200 frames, native browser scroll" },
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
  new: "bg-primary/10 text-primary-ink",
  improved: "bg-blue-500/10 text-blue-400",
  fixed: "bg-emerald-500/10 text-emerald-400",
  removed: "bg-red-500/10 text-red-400",
};

export default function ChangelogPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="pt-20 pb-8 text-center px-6">
        <Badge variant="outline" className="mb-5 border-primary/40 text-primary-ink bg-primary/10 px-4 py-1.5">
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

      <SiteFooter compact />
    </main>
  );
}
