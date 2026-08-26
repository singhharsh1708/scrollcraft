import Link from "next/link";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <article className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-sm">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: June 2026</p>

        <h2>Information We Collect</h2>
        <p>We collect information you provide directly — name and email when you sign in with GitHub or Google. We also collect usage data (pages visited, features used) via server logs to improve the product.</p>

        <h2>How We Use It</h2>
        <p>We use your information to: operate and improve ScrollCraft, send transactional emails (receipts, plan changes), and respond to support requests. We do not sell your data.</p>

        <h2>Data Storage</h2>
        <p>User data is stored in a PostgreSQL database hosted on Neon. Files you create are associated with your account and stored in our database. Exported ZIPs are generated on-demand and not stored server-side.</p>

        <h2>Third-Party Services</h2>
        <ul>
          <li><strong>GitHub / Google OAuth</strong> — for sign-in only; we receive your name and email.</li>
          <li><strong>Razorpay</strong> — payment processing for INR subscriptions. We store order IDs, not card details.</li>
          <li><strong>Lemon Squeezy</strong> — payment processing for one-time exports. We store order IDs, not card details.</li>
          <li><strong>Vercel</strong> — hosting; request logs may be retained per their policy.</li>
        </ul>

        <h2>Cookies</h2>
        <p>We use a session cookie (HttpOnly, Secure) to keep you signed in. No advertising or tracking cookies are used. See our <Link href="/cookies" className="underline">Cookie Policy</Link> for details.</p>

        <h2>Your Rights</h2>
        <p>You may request deletion of your account and associated data at any time by emailing <a href="mailto:hello@scrollcraft.app" className="underline">hello@scrollcraft.app</a>. We will process deletion within 30 days.</p>

        <h2>Contact</h2>
        <p>Questions? Email <a href="mailto:hello@scrollcraft.app" className="underline">hello@scrollcraft.app</a>.</p>
      </article>
      <SiteFooter compact />
    </main>
  );
}
