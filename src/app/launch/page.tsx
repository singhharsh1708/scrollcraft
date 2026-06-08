"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, Copy, Sparkles, Zap, Download, Play, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const PROMO_CODE = "PHHUNT";
const DISCOUNT = 30;

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI-generated scroll frames",
    desc: "Describe a visual vibe — noir cityscape, golden gradient, neon particles — and get 400+ canvas frames in seconds.",
  },
  {
    icon: Zap,
    title: "Scroll-linked animation engine",
    desc: "Our canvas engine maps your scroll position to the exact frame, delivering 10–40 FPS animations with zero JavaScript libraries.",
  },
  {
    icon: Download,
    title: "One-click pure HTML export",
    desc: "Download a ZIP with index.html, frames, and audio. Deploy to Vercel, Netlify, or any static host in under a minute.",
  },
  {
    icon: Play,
    title: "Bring your own video",
    desc: "Upload an MP4 or paste a URL. We extract frames automatically — your drone footage, product video, or Runway clip becomes a scroll experience.",
  },
];

const TESTIMONIALS = [
  {
    name: "Arjun M.",
    role: "Startup founder · India",
    quote: "Replaced a $4,000 agency quote with a 15-minute session. The output was honestly better than what they proposed.",
  },
  {
    name: "Lukas B.",
    role: "Indie developer · Germany",
    quote: "Launched my SaaS landing page before the weekend was over. The scroll animation is unlike anything I could have hand-coded.",
  },
  {
    name: "Amara O.",
    role: "Consultant · Ghana",
    quote: "My clients think I hired a design agency. I just type a prompt and export the ZIP.",
  },
];

export default function LaunchPage() {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(PROMO_CODE);
    setCopied(true);
    toast.success(`Code ${PROMO_CODE} copied!`);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight">ScrollCraft</span>
        </Link>
        <Link href="/pricing">
          <Button size="sm">View pricing</Button>
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/30 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto">
          {/* PH badge */}
          <a
            href="https://www.producthunt.com/posts/scrollcraft"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full border border-[#ff6154]/30 bg-[#ff6154]/10 text-[#ff6154] text-sm font-medium hover:bg-[#ff6154]/20 transition-colors"
          >
            <span>🚀</span>
            We&apos;re live on Product Hunt — upvote us!
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-none mb-6">
            Build cinematic<br />
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              scroll websites
            </span>
            <br />in minutes.
          </h1>

          <p className="text-xl text-muted-foreground mb-10 max-w-xl mx-auto">
            AI-generated frames. Scroll-linked animation. Pure HTML export. No code, no WebGL, no dependencies.
          </p>

          {/* Promo code banner */}
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 mb-10 p-5 rounded-2xl border border-violet-500/30 bg-violet-500/10">
            <div className="text-left">
              <p className="text-sm text-muted-foreground mb-1">Product Hunt exclusive — {DISCOUNT}% off any paid plan</p>
              <div className="flex items-center gap-3">
                <code className="text-2xl font-bold tracking-widest text-violet-300">{PROMO_CODE}</code>
                <button
                  onClick={copyCode}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-white"
                  title="Copy code"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Link href="/pricing">
              <Button className="shrink-0">
                Claim offer <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/create">
              <Button size="lg" className="w-full sm:w-auto">
                Start building free <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <a
              href="https://www.producthunt.com/posts/scrollcraft"
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=scrollcraft&theme=dark"
                alt="ScrollCraft on Product Hunt"
                width={250}
                height={54}
              />
            </a>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            7-day free trial · No credit card required · Deploy anywhere
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Everything you need, nothing you don&apos;t</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-2xl border border-white/8 bg-white/3 hover:bg-white/5 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-violet-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold text-center mb-12">What builders say</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="p-6 rounded-2xl border border-white/8 bg-white/3">
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
              <div>
                <p className="font-semibold text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-2xl mx-auto px-4 py-24 text-center">
        <Badge variant="outline" className="mb-6 text-violet-400 border-violet-500/30">
          Product Hunt exclusive
        </Badge>
        <h2 className="text-4xl font-black mb-4">
          {DISCOUNT}% off. Today only.
        </h2>
        <p className="text-muted-foreground mb-8">
          Use code <strong className="text-violet-300">{PROMO_CODE}</strong> at checkout. Start free — upgrade when you&apos;re ready.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/create">
            <Button size="lg">
              Start building free <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
          <Link href="/pricing">
            <Button size="lg" variant="outline">
              See pricing
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} ScrollCraft. Made with ♥ for builders.</p>
        <div className="flex justify-center gap-6 mt-3">
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <Link href="mailto:hello@scrollcraft.app" className="hover:text-foreground transition-colors">Contact</Link>
        </div>
      </footer>
    </main>
  );
}
