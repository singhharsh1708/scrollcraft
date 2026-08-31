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
        <p className="text-muted-foreground">Last updated: August 2026</p>

        <h2>We set none</h2>
        <p>
          ScrollCraft sets no cookies. There are no accounts, so there is no session to
          keep, and no advertising, analytics or cross-site tracking cookies are used
          either.
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
      <SiteFooter compact />
    </main>
  );
}
