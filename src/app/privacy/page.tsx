import Link from "next/link";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { CONTACT_EMAIL } from "@/lib/links";

export const metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <article className="max-w-3xl mx-auto px-6 py-20 prose prose-invert prose-sm prose-headings:font-light prose-headings:tracking-[-0.03em] prose-h1:text-5xl prose-a:text-primary-ink">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: September 2026</p>

        <h2>The short version</h2>
        <p>
          ScrollCraft has no accounts and no database. There is nothing to sign in to, so
          there is no profile, no saved history and no record of you on our side. The sites
          you build stay in your own browser until you export them.
        </p>

        <h2>What we collect</h2>
        <p>
          Your sections, copy, colours, uploaded video and audio are held in your
          browser&apos;s local storage (IndexedDB) on your own device. Nothing there is
          sent anywhere on its own.
        </p>
        <p>
          Six things can leave your browser, none of them identifying you:
        </p>
        <ul>
          <li>
            <strong>Export requests.</strong> When you export, the section text and settings
            are sent to our server so it can build the HTML, and returned to you. They are
            not written to any database or log.
          </li>
          <li>
            <strong>Rewrite requests, only if you ask for one.</strong> The editor can rewrite
            your copy from an instruction you type. Doing so sends that instruction and the
            section text to Sarvam AI, which returns the rewritten words. Nothing is sent
            unless you press Rewrite, and this instance only offers the button when it is
            configured with a key. The request is not written to any database or log.
          </li>
          <li>
            <strong>Four counts, so we can tell whether this works.</strong> Vercel Web
            Analytics, and a counter of our own, record how many people open the editor,
            make a first edit, start an export and finish one, plus which catalogue
            template was opened and how many seconds an export took. Our counter keeps
            only a running total per day, in the same Upstash store used for rate limiting.
            That is the whole list. Your headings, body copy, site name, custom CSS and
            uploads are never part of it, and a site you named yourself is counted only as
            &quot;custom&quot;.
          </li>
          <li>
            <strong>Writing a site from a description, only if you ask for one.</strong> On the
            Describe page, the words you write and any photographs you attach are sent to
            Anthropic, which writes the site and returns it. Photographs are reduced to 1024
            pixels on your own device first. Neither the description nor the photographs are
            stored by us: they are sent once, used to write that site, and not kept. Nothing is
            sent unless you press Build my site, and this instance only offers the page when it
            is configured with a key.
          </li>
          <li>
            <strong>A licence key, only if you buy more sites.</strong> The first site is
            free. A pack of five is bought from Lemon Squeezy, who take the payment and
            hold the card details, the name and the billing address; we never see them. They
            send us the key they issued you and the email you bought with. We store a
            one-way hash of that key, the email, and how many sites of the pack are left.
            Pasting the key into ScrollCraft sends it once to Lemon Squeezy to be checked.
          </li>
          <li>
            <strong>Ordinary request logs.</strong> Our host records the usual server access
            logs, including IP addresses, which we also use to rate-limit the export,
            rewrite, counting, site-writing and licence endpoints so one visitor cannot exhaust them for
            everyone. Writing a site costs us real money per request, so that one is limited
            tightly: three a minute and twenty a day from one address.
          </li>
        </ul>
        <p>
          Uploaded video is <strong>never</strong> sent anywhere. Frames are extracted from
          it inside your browser.
        </p>

        <h2>Third-party services</h2>
        <ul>
          <li><strong>Vercel</strong> — hosting, and Web Analytics for the four counts above. Request logs may be retained under their policy.</li>
          <li><strong>Sentry</strong> — error reports, when enabled. These carry a stack trace, not your content.</li>
          <li><strong>Upstash</strong> — rate limiting and the daily counts above, when enabled. It stores a counter keyed by IP for limits, and counters keyed by date for the four steps.</li>
          <li><strong>Anthropic</strong> — writes a site from your description, when enabled. It receives that description and any photographs you attach, and only when you press Build my site.</li>
          <li><strong>Lemon Squeezy</strong> &mdash; the shop, when enabled. It is the seller of record for a pack of sites: it receives your payment details directly and tells us only which licence key was issued, for which order, to which email.</li>
          <li><strong>Sarvam AI</strong> — the rewrite assistant, when enabled. It receives the instruction you type and the copy of the site you are editing, and only when you press Rewrite.</li>
          <li><strong>Google Fonts</strong> — templates load webfonts, which discloses your IP to Google. Exported sites do the same unless you self-host the fonts.</li>
        </ul>

        <h2>Cookies</h2>
        <p>
          Two, both around the site writer and neither readable by scripts: a random name
          for this browser, so your free site is yours rather than one shared with everybody
          on the same network, and, if you buy a pack, the hash of your licence key so this
          browser can spend what you paid for. There is no session to keep, and no
          advertising or analytics cookies are used. See our <Link href="/cookies" className="underline">Cookie Policy</Link>.
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
      <SiteFooter />
    </main>
  );
}
