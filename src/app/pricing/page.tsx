import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { pageMeta } from "@/lib/pageMeta";
import KeyBox from "./KeyBox";

export const metadata: Metadata = pageMeta({
  title: "Pricing",
  description:
    "The editor, the templates and the exporter are free. Writing a site from a description costs money per request, so the first one is free and five more are $20.",
  path: "/pricing",
});

const FREE = [
  "Every template in the catalogue",
  "The whole editor, with no watermark",
  "Export as plain HTML, CSS and JavaScript",
  "Host the export anywhere, or nowhere",
  "One site written from your description",
];

const PACK = [
  "Five more sites written from a description",
  "Photographs read for the words and the colours",
  "Credits never expire and nothing renews",
  "A failed request costs no credit",
  "Unused credits refunded within 14 days",
];

export default function PricingPage() {
  const checkout = process.env.NEXT_PUBLIC_LEMON_CHECKOUT_URL ?? "";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <section className="mx-auto max-w-5xl px-6 pb-24 pt-20">
        <h1 className="lc-display text-4xl md:text-5xl">
          <span className="block">Free to build.</span>
          <span className="block text-primary-ink">Paid only when a model writes for you.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-muted-foreground">
          Editing and exporting cost us nothing, so they cost you nothing. Writing a site from
          a description costs real money per request, so that part is priced at what it costs
          plus enough to keep the lights on.
        </p>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-8">
            <p className="lc-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">The tool</p>
            <p className="mt-4 lc-display text-4xl">Free</p>
            <p className="mt-2 text-sm text-muted-foreground">No account needed, no card, no trial.</p>
            <ul className="mt-7 space-y-3 text-sm">
              {FREE.map((line) => (
                <li key={line} className="flex gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-ink" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <Link href="/describe" className="lc-btn lc-btn-ghost lc-btn-sm mt-8">
              Write your free site
            </Link>
          </div>

          <div className="rounded-xl border border-primary-ink/40 bg-card p-8">
            <p className="lc-mono text-xs uppercase tracking-[0.18em] text-primary-ink">Five sites</p>
            <p className="mt-4 lc-display text-4xl">
              $20<span className="ml-2 align-middle text-base text-muted-foreground">one payment</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">$4 a site. Buy again whenever you run out.</p>
            <ul className="mt-7 space-y-3 text-sm">
              {PACK.map((line) => (
                <li key={line} className="flex gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-ink" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <KeyBox checkout={checkout} />
          </div>
        </div>

        <div className="mt-16 grid gap-10 border-t border-border pt-12 md:grid-cols-3">
          <div>
            <h2 className="text-base">Why this costs anything</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Your description and photographs go to a model that writes the copy, picks the
              palette and lays the sections out. That request is billed to us whether you keep
              the site or not. Everything else here runs on your own machine.
            </p>
          </div>
          <div>
            <h2 className="text-base">What you are buying</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Five generations, not five templates. The sites are yours, exportable as plain
              files, with nothing phoning home and no licence attached to what you publish.
              Sign in with GitHub and the pack follows you to any browser.
            </p>
          </div>
          <div>
            <h2 className="text-base">Getting your money back</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Unused credits are refunded within 14 days, no questions asked. Spent ones are
              not, because the site was written. The{" "}
              <Link href="/terms" className="underline underline-offset-4">terms</Link> say it in full.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
