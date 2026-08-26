import Link from "next/link";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

export const metadata = { title: "Cookie Policy" };

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
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
        <p>Questions? Email <a href="mailto:hs1663531@gmail.com" className="underline">hs1663531@gmail.com</a>. See also our <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
      </article>
      <SiteFooter compact />
    </main>
  );
}
