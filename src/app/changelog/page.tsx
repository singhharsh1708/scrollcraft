import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Every release of ScrollCraft, what changed in it, and why.",
  alternates: { canonical: "/changelog" },
};

const ENTRIES = [
  {
    version: "v1.3.0",
    date: "September 11, 2026",
    tag: "Minor",
    tagColor: "bg-white/8 text-foreground border-white/15",
    changes: [
      { type: "improved", text: "A redesigned site: deep navy and pale blue, light display type, and monospaced labels for every piece of navigation" },
      { type: "improved", text: "The landing page walks through the whole path from template to live site, stage by stage, using the product's own templates, editor copy and export contents in each panel" },
      { type: "new", text: "One full footer on every page, with the documentation, source and plugin a click away" },
      { type: "fixed", text: "The plugin link pointed at a README heading that no longer existed" },
    ],
  },
  {
    version: "v1.2.0",
    date: "September 7, 2026",
    tag: "Minor",
    tagColor: "bg-white/8 text-foreground border-white/15",
    changes: [
      { type: "new", text: "Examples — three finished sites at /examples, each link opening the exported bundle itself rather than a preview of it" },
      { type: "new", text: "Each example is a committed spec built by the same scripts the skill ships, so the page cannot drift from what the exporter actually produces" },
      { type: "new", text: "Every example is checked with verify.mjs: the canvas has to advance and every line of copy has to clear 4.5:1 against the pixels behind it" },
      { type: "fixed", text: "Canvas previews kept animating at 60fps while scrolled out of view, spending a phone's battery on pixels nobody could see" },
    ],
  },
  {
    version: "v1.1.0",
    date: "September 7, 2026",
    tag: "Minor",
    tagColor: "bg-white/8 text-foreground border-white/15",
    changes: [
      { type: "new", text: "Copy rewriting in the editor — describe the change you want and the section copy is rewritten from it, in one undo step" },
      { type: "new", text: "The rewrite touches the words only. Layout, colours, images and button links are left as you set them, and anything that comes back malformed is discarded rather than applied" },
      { type: "new", text: "Instances without an API key do not show the button, so a fresh clone still runs on an empty environment" },
      { type: "improved", text: "The privacy page now names the rewrite request as the third thing that can leave your browser, and only when you ask for one" },
    ],
  },
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

      <section className="px-6 pb-12 pt-20 text-center">
        <p className="lc-mono mb-6 text-sm text-primary-ink">What&apos;s new</p>
        <h1 className="lc-display text-5xl md:text-6xl lg:text-7xl">Changelog</h1>
        <p className="mx-auto mt-6 max-w-md text-lg text-muted-foreground">
          Every release, what changed in it, and why.
        </p>
      </section>

      <section className="px-6 pb-24 max-w-2xl mx-auto">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[7px] top-4 bottom-4 w-px bg-border" />

          <div className="space-y-12">
            {ENTRIES.map((entry, i) => (
              <div key={entry.version} className="relative pl-8">
                {/* Dot */}
                <div className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-background ${i === 0 ? "bg-primary" : "bg-white/20"}`} />

                <div className="space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="lc-display text-2xl">{entry.version}</h2>
                    <Badge variant="outline" className={`text-xs px-2 py-0.5 border ${entry.tagColor}`}>{entry.tag}</Badge>
                    <span className="lc-mono text-xs text-muted-foreground">{entry.date}</span>
                  </div>

                  <div className="space-y-2">
                    {entry.changes.map((c, j) => (
                      <div key={j} className="flex items-start gap-2.5">
                        <span className={`lc-mono text-[11px] px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${TYPE_STYLES[c.type] || TYPE_STYLES.new}`}>
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

      <SiteFooter />
    </main>
  );
}
