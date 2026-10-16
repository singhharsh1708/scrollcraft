import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { CONTACT_EMAIL } from "@/lib/links";

export const metadata: Metadata = pageMeta({
  title: "Refund Policy",
  description: "Unused credits are refunded within 14 days, no questions asked. How to ask, and what is not refunded.",
  path: "/refunds",
});

export default function RefundsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <article className="max-w-3xl mx-auto px-6 py-20 prose prose-invert prose-sm prose-headings:font-light prose-headings:tracking-[-0.03em] prose-h1:text-5xl prose-a:text-primary-ink">
        <h1>Refund Policy</h1>
        <p className="text-muted-foreground">Last updated: October 2026</p>

        <h2>What you can get back</h2>
        <p>
          The editor, the templates and the exporter are free, so the only thing ever paid
          for is a pack of five sites written from a description, at $20. Unused credits from
          a pack are refunded on request within 14 days of buying it, no questions asked.
        </p>
        <p>
          Credits already spent are not refundable, because the site was written and the cost
          of writing it was incurred. A pack that is partly used is refunded pro rata for what
          is left: two sites unused out of five is $8 back.
        </p>
        <p>
          A request that fails costs no credit in the first place, so there is nothing to
          refund for it.
        </p>

        <h2>How to ask</h2>
        <p>
          Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the order number
          from your receipt. The refund goes back to the card or method you paid with, and the
          refunded credits are taken off your account.
        </p>

        <h2>If the site writer goes away</h2>
        <p>
          If we stop offering the site writer, you get 30 days&apos; notice and unused credits
          are refunded on request, whenever you bought them. Sites you have already made are
          yours and keep working.
        </p>

        <p>
          The full terms are in the <Link href="/terms" className="underline">Terms of Service</Link>.
        </p>
      </article>
      <SiteFooter />
    </main>
  );
}
