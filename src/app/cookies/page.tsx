import Link from "next/link";
import { Sparkles } from "lucide-react";

export const metadata = { title: "Cookie Policy — ScrollCraft" };

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight">ScrollCraft</span>
        </Link>
      </nav>
      <article className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-sm">
        <h1>Cookie Policy</h1>
        <p className="text-muted-foreground">Last updated: June 2026</p>

        <h2>What Are Cookies</h2>
        <p>Cookies are small text files stored in your browser. We use them to keep you signed in across page loads.</p>

        <h2>Cookies We Use</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Purpose</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>authjs.session-token</code></td>
              <td>Keeps you signed in (HttpOnly, Secure)</td>
              <td>30 days</td>
            </tr>
            <tr>
              <td><code>authjs.csrf-token</code></td>
              <td>CSRF protection for sign-in forms</td>
              <td>Session</td>
            </tr>
            <tr>
              <td><code>authjs.callback-url</code></td>
              <td>Stores redirect target after sign-in</td>
              <td>Session</td>
            </tr>
          </tbody>
        </table>

        <h2>No Tracking or Advertising Cookies</h2>
        <p>We do not use any advertising, analytics, or third-party tracking cookies. We do not participate in cross-site tracking.</p>

        <h2>Managing Cookies</h2>
        <p>You can clear cookies through your browser settings at any time. Clearing the session cookie will sign you out. Disabling cookies will prevent sign-in from working.</p>

        <h2>Contact</h2>
        <p>Questions? Email <a href="mailto:hello@scrollcraft.xyz" className="underline">hello@scrollcraft.xyz</a>. See also our <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
      </article>
    </main>
  );
}
