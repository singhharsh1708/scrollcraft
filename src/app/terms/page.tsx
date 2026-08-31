import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <article className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-sm">
        <h1>Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: August 2026</p>

        <h2>Acceptance</h2>
        <p>By using ScrollCraft you agree to these terms. If you do not agree, do not use the service.</p>

        <h2>What ScrollCraft Does</h2>
        <p>ScrollCraft is a free, open-source tool for building scroll-animated websites. You pick a template or a style, edit it in your browser, and export a production-ready HTML/CSS/JS site. It runs without an account and stores nothing about you.</p>

        <h2>Your Content</h2>
        <p>You own the websites and content you create with ScrollCraft, outright. We claim no rights over them and we do not hold them: your work stays in your browser until you export it. No licence to store or display it is granted or needed.</p>

        <h2>Acceptable Use</h2>
        <p>Do not use ScrollCraft to create content that is illegal, harmful, or violates third-party rights. There are no accounts to suspend, so this is a request rather than a threat — but the licence below does not authorise unlawful use.</p>

        <h2>No Charge</h2>
        <p>ScrollCraft is free. There is no subscription, no purchase and no payment of any kind, so there is nothing to refund and no price to change.</p>

        <h2>The Source</h2>
        <p>ScrollCraft is open source and you may run, modify and self-host it under the terms of its licence in the repository. These terms cover the hosted instance only.</p>

        <h2>Disclaimer</h2>
        <p>ScrollCraft is provided &quot;as is&quot; without warranty of any kind. We are not liable for indirect, incidental, or consequential damages arising from your use of it. In particular: unexported work lives only in your browser, and clearing your browser data will delete it.</p>

        <h2>Governing Law</h2>
        <p>These terms are governed by the laws of India. Disputes shall be resolved in courts of competent jurisdiction in India.</p>

        <h2>Contact</h2>
        <p>Questions? Email <a href="mailto:hs1663531@gmail.com" className="underline">hs1663531@gmail.com</a>.</p>
      </article>
      <SiteFooter compact />
    </main>
  );
}
