"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Zap, ChevronDown, Mail } from "lucide-react";
import Navbar from "@/components/Navbar";
import { PLANS, siteAllowance } from "@/lib/plans";
import { TEMPLATES } from "@/lib/templates";
import { PRESETS } from "@/lib/presets";

// ScrollCraft is free. The subscription tiers this page used to sell are retired — see
// the note in lib/plans.ts — so there is no billing toggle, no promo field and no
// checkout here any more. Revenue comes from enterprise work arranged by email.

const FREE_FEATURES = [
  `All ${TEMPLATES.length} templates`,
  `All ${PRESETS.length} background presets`,
  "Visual editor with undo history",
  `${siteAllowance("FREE")} saved websites`,
  "Publish to a hosted link",
  "ZIP export — the code is yours",
  "Deploy anywhere that serves static files",
];

const FAQ = [
  {
    q: "Is it really free?",
    a: `Yes. Every one of the ${TEMPLATES.length} templates, the editor, publishing and ZIP export cost nothing, and there is no time limit. You keep ${siteAllowance("FREE")} saved websites on a free account.`,
  },
  {
    q: "What's the catch on ZIP export?",
    a: "There isn't one. Export downloads plain HTML, CSS and JavaScript you own outright — no build step, no runtime dependency on us, and nothing phones home. Host it anywhere that serves static files.",
  },
  {
    q: "Do published pages carry a badge?",
    a: "A published page carries a small ScrollCraft badge and is not indexed by search engines. If you need an unbadged, indexable page for a client, that is what the enterprise route is for.",
  },
  {
    q: "I subscribed before. What happens to my plan?",
    a: "Nothing you paid for is taken away. The old tiers are retired, but your account keeps its saved-website allowance, and the free allowance is a floor — you can never end up with less than a new free account.",
  },
  {
    q: "What does enterprise cover?",
    a: "A custom scroll site built for your brand by us: your own design rather than a template, white-labelled pages, and a support arrangement in writing. Email us and we will scope it.",
  },
];

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <main className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />

      {/* Header */}
      <section className="pt-20 pb-12 text-center px-6">
        <div className="absolute left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-primary/8 blur-[100px] pointer-events-none" />
        <Badge variant="outline" className="mb-5 border-primary/40 text-primary bg-primary/10 px-4 py-1.5">
          <Zap className="w-3 h-3 mr-1.5" /> Free, with no time limit
        </Badge>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-4">
          It&apos;s free.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
            All of it.
          </span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Every template, the editor, publishing and ZIP export. No card, no trial clock,
          no feature held back. Need something built for your brand? That part we charge for.
        </p>
      </section>

      {/* Free + Enterprise */}
      <section className="px-6 pb-20 max-w-5xl mx-auto grid md:grid-cols-2 gap-6 items-start">
        {/* Free */}
        <div className="relative rounded-2xl border border-primary/30 bg-card p-7 shadow-xl shadow-primary/5">
          <div className="absolute -top-3 left-7">
            <Badge className="bg-primary text-white border-0 px-3">Everything, free</Badge>
          </div>
          <p className="font-semibold text-lg mb-1 mt-1">{PLANS.FREE.label}</p>
          <div className="flex items-end gap-1 mb-5">
            <span className="text-5xl font-black tracking-tighter">₹0</span>
            <span className="text-muted-foreground text-sm mb-2">forever</span>
          </div>
          <ul className="space-y-2.5 mb-7">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link href="/templates">
            <Button className="w-full bg-primary hover:bg-primary/90 text-white font-semibold">
              Pick a template <Sparkles className="ml-2 w-4 h-4" />
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground/70 text-center mt-3">
            No credit card. Sign in with GitHub or Google.
          </p>
        </div>

        {/* Enterprise */}
        <div className="rounded-2xl border border-white/8 bg-card p-7">
          <p className="font-semibold text-lg mb-1">Enterprise</p>
          <div className="flex items-end gap-1 mb-5">
            <span className="text-3xl font-black tracking-tighter">Let&apos;s talk</span>
          </div>
          <p className="text-muted-foreground text-sm mb-5">
            A scroll site designed for your brand rather than started from a template, built
            and handed over by us.
          </p>
          <ul className="space-y-2.5 mb-7">
            {[
              "Custom design, not a template",
              "Built and handed over by our team",
              "White-labelled, badge-free pages",
              "Search-indexable published pages",
              "Support terms agreed in writing",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link href="/contact">
            <Button variant="outline" className="w-full border-white/10 hover:bg-white/5 font-semibold">
              <Mail className="mr-2 w-4 h-4" /> Contact us
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground/70 text-center mt-3">
            Or email hello@scrollcraft.app directly.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-24 max-w-3xl mx-auto">
        <h2 className="text-2xl font-black tracking-tighter text-center mb-8">Questions</h2>
        <div className="space-y-2">
          {FAQ.map((item, i) => (
            <div key={item.q} className="rounded-xl border border-white/8 bg-card overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
                className="w-full flex items-center justify-between gap-4 p-4 text-left text-sm font-medium hover:bg-white/2 transition-colors"
              >
                {item.q}
                <ChevronDown
                  className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                />
              </button>
              {openFaq === i && (
                <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="pb-24 px-6 text-center border-t border-white/5 pt-20">
        <h2 className="text-4xl font-black tracking-tighter mb-4">Start free. Stay free.</h2>
        <p className="text-muted-foreground mb-8">
          Nothing to cancel, because there is nothing to subscribe to.
        </p>
        <Link href="/templates">
          <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-10 py-6 text-base font-semibold shadow-xl shadow-primary/30">
            Browse templates <Sparkles className="ml-2 w-4 h-4" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/5 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-primary" />
          </div>
          ScrollCraft — Built with Next.js
        </div>
      </footer>
    </main>
  );
}
