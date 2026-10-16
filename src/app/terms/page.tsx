import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import { paymentProcessor } from "@/lib/paymentProcessor";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = pageMeta({
  title: "Terms of Service",
  description: "What you may do with ScrollCraft, what a pack of generations is, and how refunds work.",
  path: "/terms",
});

export default function TermsPage() {
  const processor = paymentProcessor();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <article className="max-w-3xl mx-auto px-6 py-20 prose prose-invert prose-sm prose-headings:font-light prose-headings:tracking-[-0.03em] prose-h1:text-5xl prose-a:text-primary-ink">
        <h1>Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: October 2026</p>

        <h2>Acceptance</h2>
        <p>By using ScrollCraft you agree to these terms. If you do not agree, do not use the service.</p>

        <h2>What ScrollCraft Does</h2>
        <p>ScrollCraft is a free, open-source tool for building scroll-animated websites. You pick a template or a style, edit it in your browser, and export a production-ready HTML/CSS/JS site. You can use all of that without an account. Writing a site from a description is the one part that costs money, and the one part that keeps a record: see the privacy policy for exactly what that record is.</p>

        <h2>Your Content</h2>
        <p>You own the websites and content you create with ScrollCraft, outright. We claim no rights over them and we do not hold them: your work stays in your browser until you export it. No licence to store or display it is granted or needed.</p>

        <h2>Acceptable Use</h2>
        <p>Do not use ScrollCraft to create content that is illegal, harmful, or violates third-party rights. The licence below does not authorise unlawful use, and an account that is used for it can lose access to the site writer.</p>

        <h2>What Costs Money</h2>
        <p>The editor, the templates, the catalogue and the exporter are free and always will be: no subscription, no account needed, no limit on how many sites you build or export by hand.</p>
        <p>Writing a site from a description costs us money per request, because a model writes it. So the first four are free, and after that five sites cost $20, bought once. There is no subscription and nothing renews.</p>

        <h2>Credits</h2>
        <p>A pack is a prepaid licence to use the site writer five times. Credits are not money, cannot be exchanged for it, and are not transferable. They do not expire. A credit is taken when a site is written and given back if the request fails, so a failure costs you nothing.</p>
        {processor && (
          <p>Buying a pack needs you to sign in with GitHub, so that the pack belongs to an account rather than to a browser that can be cleared. Nothing else here needs you to sign in. Credits belong to the account that bought them and are there in any browser that account signs in on.</p>
        )}
        {processor === "dodo" ? (
          <p>Packs are sold through Dodo Payments, who are the merchant of record: they take the payment, send the invoice and handle any sales tax or VAT. We never see your card. Prices are in US dollars, and any tax your country charges is added at checkout.</p>
        ) : processor === "stripe" ? (
          <p>Packs are sold by us and paid for on Stripe&apos;s own page. Stripe handle the card and send the receipt; we never see the card. Prices are in US dollars and do not include any tax your own country may add.</p>
        ) : (
          <p>No packs are on sale on this deployment at the moment.</p>
        )}

        <h2>Refunds</h2>
        <p>Unused credits are refunded on request within 14 days, no questions asked: email the address below with your order number. Credits already spent are not refundable, because the site was written and the cost was incurred. A partial refund is pro-rated over what is left.</p>

        <h2>If The Site Writer Goes Away</h2>
        <p>If we stop offering the site writer, you get 30 days&apos; notice, the editor and the exporter keep working, and unused credits are refunded on request. Sites you have already made are yours and live in your browser, so nothing you built stops working.</p>

        <h2>The Source</h2>
        <p>ScrollCraft is open source and you may run, modify and self-host it under the terms of its licence in the repository. These terms cover the hosted instance only.</p>

        <h2>Disclaimer</h2>
        <p>ScrollCraft is provided &quot;as is&quot; without warranty of any kind. We are not liable for indirect, incidental, or consequential damages arising from your use of it. In particular: unexported work lives only in your browser, and clearing your browser data will delete it.</p>

        <h2>Governing Law</h2>
        <p>These terms are governed by the laws of India. Disputes shall be resolved in courts of competent jurisdiction in India.</p>

        <h2>Contact</h2>
        <p>Questions? Email <a href="mailto:hs1663531@gmail.com" className="underline">hs1663531@gmail.com</a>.</p>
      </article>
      <SiteFooter />
    </main>
  );
}
