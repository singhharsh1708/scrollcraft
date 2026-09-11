export const revalidate = 86400; // revalidate once per day

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Sparkles, Zap, Globe, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import { PRESETS } from "@/lib/presets";
import { TEMPLATES } from "@/lib/templates";
import { AUTHOR_NAME, AUTHOR_SITE_URL, GITHUB_PROFILE_URL, LINKEDIN_URL } from "@/lib/links";
import SiteFooter from "@/components/SiteFooter";

// One real person, described accurately. "The team" was previously two cards, one of
// which was the template library given a job title.
const TEAM = [
  {
    name: AUTHOR_NAME,
    role: "Builds and maintains ScrollCraft",
    avatar: "HS",
    bio: "Open source engineer. Writes the scroll engine, the templates and the exporter, and answers the issues.",
    links: [
      { label: "GitHub", href: GITHUB_PROFILE_URL },
      { label: "LinkedIn", href: LINKEDIN_URL },
      { label: "singhharsh.in", href: AUTHOR_SITE_URL },
    ],
  },
];

const VALUES = [
  { icon: Sparkles, title: "Ready to ship", desc: "Every template is a finished site, not a blank canvas. Pick one and change the words." },
  { icon: Zap, title: "Nothing to wait for", desc: "No signup, no build step, no keys. Open the editor and you are already working." },
  { icon: Globe, title: "Own your code", desc: "Everything you export belongs to you. No lock-in, ever." },
  { icon: Users, title: "Built for builders", desc: "Freelancers, founders, agencies — we build for people who make things." },
];

export default function AboutPage() {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <Navbar />

      {/* Hero */}
      <section className="px-6 pb-20 pt-24 text-center">
        <p className="lc-mono mb-6 text-sm text-primary-ink">About</p>
        <h1 className="lc-display mx-auto max-w-4xl text-5xl md:text-6xl lg:text-7xl">
          <span className="block">The web should move</span>
          <span className="block text-primary-ink">when you scroll it</span>
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Scroll-driven sites used to need a studio budget and a specialist who knew WebGL.
          ScrollCraft puts a library of finished templates, frame extraction and a scroll
          engine into one tool, and then gets out of your way.
        </p>
      </section>

      {/* Mission */}
      <section className="border-t border-border px-6 py-24">
        <div className="mx-auto grid max-w-[1200px] items-center gap-14 md:grid-cols-2">
          <div>
            <p className="lc-mono mb-5 text-sm text-primary-ink">The mission</p>
            <h2 className="lc-display text-4xl sm:text-5xl">Cinematic sites for people without a studio</h2>
            <p className="mt-6 leading-relaxed text-muted-foreground">
              A restaurant owner in Accra shouldn&apos;t need a $4,000 agency to have a
              world-class website. A solo founder launching a SaaS shouldn&apos;t have to learn
              WebGL to make an impression.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Pick a template, change the words, and export a site you own outright.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
            {[
              { value: String(TEMPLATES.length), label: "Finished templates" },
              { value: String(PRESETS.length), label: "Styles and palettes" },
              { value: "<2s", label: "Load time target" },
              { value: "100%", label: "Code ownership" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col-reverse bg-card p-6">
                <dt className="lc-mono mt-2 text-xs text-muted-foreground">{s.label}</dt>
                <dd className="lc-display text-5xl text-primary-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="lc-display text-4xl sm:text-5xl">
            <span className="block">What we</span>
            <span className="block text-primary-ink">believe</span>
          </h2>
          <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v) => (
              <div key={v.title} className="bg-card p-7">
                <v.icon className="h-5 w-5 text-primary-ink" aria-hidden="true" />
                <h3 className="mt-6 text-lg font-medium tracking-[-0.01em]">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="border-t border-border px-6 py-24">
        <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[1fr_1.3fr] lg:items-start">
          <h2 className="lc-display text-4xl sm:text-5xl">
            <span className="block">Built by</span>
            <span className="block text-primary-ink">one person</span>
          </h2>
          {TEAM.map((m) => (
            <div key={m.name} className="flex items-start gap-5 rounded-lg border border-border bg-card p-7">
              <div className="lc-mono flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary-ink/40 text-sm text-primary-ink">
                {m.avatar}
              </div>
              <div>
                <p className="text-lg font-medium">{m.name}</p>
                <p className="lc-mono mb-3 text-xs text-primary-ink">{m.role}</p>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{m.bio}</p>
                <div className="flex flex-wrap gap-5">
                  {m.links.map((l) => (
                    <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="lc-link">
                      {l.label} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border px-6 py-28 text-center">
        <h2 className="lc-display text-5xl sm:text-6xl">
          <span className="block">Come build</span>
          <span className="block text-primary-ink">with us</span>
        </h2>
        <p className="mx-auto mb-10 mt-6 max-w-md text-lg text-muted-foreground">
          No account, no install. Pick a template and export a finished site.
        </p>
        <Link href="/create" className="lc-btn lc-btn-solid">
          Start building <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      <SiteFooter />
    </main>
  );
}
