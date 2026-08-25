export const revalidate = 86400; // revalidate once per day

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, Zap, Globe, Users } from "lucide-react";
import Navbar from "@/components/Navbar";

const TEAM = [
  { name: "Harsh Singh", role: "Founder & Engineer", avatar: "HS", bio: "Building the future of no-code web experiences." },
  { name: "Templates", role: "The library", avatar: "TL", bio: "A growing catalogue of finished scroll sites, free on every plan." },
];

const VALUES = [
  { icon: Sparkles, title: "Ready to ship", desc: "Every template is a finished site, not a blank canvas. Pick one and change the words." },
  { icon: Zap, title: "Ship fast", desc: "We release weekly. Features, fixes, and improvements every single week." },
  { icon: Globe, title: "Own your code", desc: "Everything you export belongs to you. No lock-in, ever." },
  { icon: Users, title: "Built for builders", desc: "Freelancers, founders, agencies — we build for people who make things." },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* Hero */}
      <section className="pt-24 pb-16 text-center px-6">
        <div className="absolute left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-primary/8 blur-[100px] pointer-events-none" />
        <Badge variant="outline" className="mb-5 border-primary/40 text-primary bg-primary/10 px-4 py-1.5">Our story</Badge>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-6 max-w-3xl mx-auto">
          The web should be
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400"> cinematic</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          We started ScrollCraft because we were tired of flat, boring websites. 
          Immersive animated scroll experiences existed — but only for teams with six-figure budgets and specialist engineers.
          We fixed that.
        </p>
      </section>

      {/* Mission */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <Badge variant="outline" className="mb-4 border-white/10">Our mission</Badge>
            <h2 className="text-3xl font-black tracking-tighter mb-4">
              Make cinematic websites accessible to everyone
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              A restaurant owner in Accra shouldn&apos;t need a $4,000 agency to have a world-class website. 
              A solo founder launching a SaaS shouldn&apos;t have to learn WebGL to make an impression.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              ScrollCraft puts a library of finished templates, frame extraction, and a production-grade scroll engine 
              into a single tool — and gets out of your way.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: "400+", label: "Frames per site" },
              { value: "12", label: "Presets & counting" },
              { value: "<2s", label: "Load time target" },
              { value: "100%", label: "Code ownership" },
            ].map(s => (
              <div key={s.label} className="p-5 rounded-2xl border border-white/8 bg-card text-center">
                <p className="text-3xl font-black text-primary mb-1">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-white/10">What we believe</Badge>
            <h2 className="text-3xl font-black tracking-tighter">Our values</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {VALUES.map(v => (
              <div key={v.title} className="p-6 rounded-2xl border border-white/8 bg-card">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-4">
                  <v.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-white/10">The team</Badge>
            <h2 className="text-3xl font-black tracking-tighter">Built by builders</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {TEAM.map(m => (
              <div key={m.name} className="flex items-start gap-4 p-6 rounded-2xl border border-white/8 bg-card">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                  {m.avatar}
                </div>
                <div>
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-xs text-primary mb-2">{m.role}</p>
                  <p className="text-sm text-muted-foreground">{m.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center border-t border-white/5">
        <h2 className="text-4xl font-black tracking-tighter mb-4">Come build with us</h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">Start free. No credit card. Your first scroll site in under 5 minutes.</p>
        <Link href="/create">
          <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-10 py-6 font-semibold">
            Start for free <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </Link>
      </section>

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
