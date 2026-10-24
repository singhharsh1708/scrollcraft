import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = pageMeta({
  title: "Cookie Policy",
  description: "The three cookies ScrollCraft can set, what each is for, and what clearing them costs you.",
  path: "/cookies",
});

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <article className="max-w-3xl mx-auto px-6 py-20 prose prose-invert prose-sm prose-headings:font-light prose-headings:tracking-[-0.03em] prose-h1:text-5xl prose-a:text-primary-ink">
        <h1>Cookie Policy</h1>
        <p className="text-muted-foreground">Last updated: October 2026</p>

        <h2>Three at most, and only if you use what needs them</h2>
        <p>
          No advertising, analytics or cross-site tracking cookies are used, and none of
          these is set until you do something that needs it:
        </p>
        <ul>
          <li>
            <strong>sc_fid</strong> &mdash; a random name for this browser, set the first
            time you have a site written. It is what makes your free sites yours rather
            than shared with everybody on the same network. It holds nothing about
            you and is never read by anybody else.
          </li>
          <li>
            <strong>A session cookie</strong> &mdash; set only when you sign in, and
            only to keep you signed in. Signing out removes it.
          </li>
          <li>
            <strong>sc_key</strong> &mdash; set only if you buy a pack and paste your
            licence key. It holds a one-way hash of that key, so this browser can spend
            what you paid for.
          </li>
        </ul>
        <p>
          None of them is readable by scripts on the page, none leaves this site, and
          clearing them costs you nothing except signing in or pasting your key again.
        </p>

        <h2>What is stored on your device</h2>
        <p>
          Not a cookie, but worth being clear about: the sites you build are held in your
          browser&apos;s local storage (IndexedDB) on your own machine, so your work
          survives a page reload. It is never sent to us.
        </p>
        <p>
          Clearing this site&apos;s data in your browser erases it, including any site you
          have not exported yet.
        </p>

        <h2>Third parties</h2>
        <p>
          Templates and exported sites load webfonts from Google Fonts, which discloses
          your IP address to Google. Google Fonts sets no cookies for this use. Self-host
          the font files in an export if you would rather it did not.
        </p>

        <h2>Contact</h2>
        <p>Questions? Email <a href="mailto:hs1663531@gmail.com" className="underline">hs1663531@gmail.com</a>. See also our <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
      </article>
      <SiteFooter />
    </main>
  );
}
