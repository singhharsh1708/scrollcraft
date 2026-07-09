import Navbar from "@/components/Navbar";

export const metadata = { title: "Terms of Service — ScrollCraft" };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <article className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-sm">
        <h1>Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: June 2026</p>

        <h2>Acceptance</h2>
        <p>By using ScrollCraft you agree to these terms. If you do not agree, do not use the service.</p>

        <h2>What ScrollCraft Does</h2>
        <p>ScrollCraft is an AI-powered tool that generates scroll-animated websites. You describe a visual style, the AI generates canvas frames, and you export a production-ready HTML/CSS/JS site.</p>

        <h2>Your Content</h2>
        <p>You own the websites and content you create with ScrollCraft. We claim no intellectual property rights over your exported sites. You grant us a limited license to store and display your projects within the app.</p>

        <h2>Acceptable Use</h2>
        <p>You may not use ScrollCraft to create content that is illegal, harmful, or violates third-party rights. We reserve the right to terminate accounts that violate this policy.</p>

        <h2>Payments</h2>
        <p>Subscription and one-time export fees are non-refundable except as required by law or at our sole discretion. Prices may change with 30 days notice.</p>

        <h2>Disclaimer</h2>
        <p>ScrollCraft is provided &quot;as is&quot; without warranty of any kind. We are not liable for indirect, incidental, or consequential damages arising from your use of the service.</p>

        <h2>Governing Law</h2>
        <p>These terms are governed by the laws of India. Disputes shall be resolved in courts of competent jurisdiction in India.</p>

        <h2>Contact</h2>
        <p>Questions? Email <a href="mailto:hello@scrollcraft.xyz" className="underline">hello@scrollcraft.xyz</a>.</p>
      </article>
    </main>
  );
}
