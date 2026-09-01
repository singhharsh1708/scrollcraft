import Link from "next/link";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { CONTACT_EMAIL } from "@/lib/links";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <article className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-sm">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: August 2026</p>

        <h2>The short version</h2>
        <p>
          ScrollCraft has no accounts and no database. There is nothing to sign in to, so
          there is no profile, no saved history and no record of you on our side. The sites
          you build stay in your own browser until you export them.
        </p>

        <h2>What we collect</h2>
        <p>
          Nothing you type into ScrollCraft reaches us. Your sections, copy, colours,
          uploaded video and audio are held in your browser&apos;s local storage
          (IndexedDB) on your own device.
        </p>
        <p>
          Two things do leave your browser, both without identifying you:
        </p>
        <ul>
          <li>
            <strong>Export requests.</strong> When you export, the section text and settings
            are sent to our server so it can build the HTML, and returned to you. They are
            not written to any database or log.
          </li>
          <li>
            <strong>Ordinary request logs.</strong> Our host records the usual server access
            logs, including IP addresses, which we also use to rate-limit the export endpoint
            so one visitor cannot exhaust it for everyone.
          </li>
        </ul>
        <p>
          Uploaded video is <strong>never</strong> sent anywhere. Frames are extracted from
          it inside your browser.
        </p>

        <h2>Third-party services</h2>
        <ul>
          <li><strong>Vercel</strong> — hosting. Request logs may be retained under their policy.</li>
          <li><strong>Sentry</strong> — error reports, when enabled. These carry a stack trace, not your content.</li>
          <li><strong>Upstash</strong> — rate limiting, when enabled. It stores a counter keyed by IP.</li>
          <li><strong>Google Fonts</strong> — templates load webfonts, which discloses your IP to Google. Exported sites do the same unless you self-host the fonts.</li>
        </ul>

        <h2>Cookies</h2>
        <p>
          We set no cookies at all. There is no session to keep, and no advertising or
          analytics cookies are used. See our <Link href="/cookies" className="underline">Cookie Policy</Link>.
        </p>

        <h2>Your rights</h2>
        <p>
          There is no account to delete and no data of yours for us to hold. To remove what
          ScrollCraft has stored on your device, clear this site&apos;s data in your browser
          — that erases every unexported site, so export anything you want to keep first.
        </p>

        <h2>Contact</h2>
        <p>
          Questions? Email <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>.
        </p>
      </article>
      <SiteFooter compact />
    </main>
  );
}
