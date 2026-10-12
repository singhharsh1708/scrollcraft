import Link from "next/link";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

export const metadata = { title: "Cookie Policy", alternates: { canonical: "/cookies" } };

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <article className="max-w-3xl mx-auto px-6 py-20 prose prose-invert prose-sm prose-headings:font-light prose-headings:tracking-[-0.03em] prose-h1:text-5xl prose-a:text-primary-ink">
        <h1>Cookie Policy</h1>
        <p className="text-muted-foreground">Last updated: August 2026</p>

        <h2>Two, and only around the site writer</h2>
        <p>
          There are no accounts, so there is no session to keep, and no advertising,
          analytics or cross-site tracking cookies are used. Writing a site from a
          description is the one paid thing here, and it needs to tell one browser from
          another, so it sets two cookies and no more:
        </p>
        <ul>
          <li>
            <strong>sc_fid</strong> &mdash; a random name for this browser, set the first
            time you have a site written. It is what makes your free site yours rather
            than one shared with everybody on the same network. It holds nothing about
            you and is never read by anybody else.
          </li>
          <li>
            <strong>sc_key</strong> &mdash; set only if you buy a pack and paste your
            licence key. It holds a one-way hash of that key, so this browser can spend
            what you paid for.
          </li>
        </ul>
        <p>
          Neither is readable by scripts on the page, neither leaves this site, and
          clearing them costs you nothing except pasting your key again.
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
