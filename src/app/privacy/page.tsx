import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import { paymentProcessor } from "@/lib/paymentProcessor";
import { authConfigured, configuredProviders, providerNames } from "@/auth";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { CONTACT_EMAIL } from "@/lib/links";

export const metadata: Metadata = pageMeta({
  title: "Privacy Policy",
  description: "What leaves your browser, what we keep if you buy a pack, and how to have it deleted.",
  path: "/privacy",
});

export default function PrivacyPage() {
  const processor = paymentProcessor();
  const providers = authConfigured() ? configuredProviders() : [];
  const accountNumber = providerNames() ? `the account number of the ${providerNames()} account you sign in with` : "your account number";
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <article className="max-w-3xl mx-auto px-6 py-20 prose prose-invert prose-sm prose-headings:font-light prose-headings:tracking-[-0.03em] prose-h1:text-5xl prose-a:text-primary-ink">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: October 2026</p>

        <h2>The short version</h2>
        <p>
          Nothing you have to sign in to in order to use the editor, the templates or the
          exporter, and no profile or saved history. The sites you build stay in your own
          browser until you export them. If you buy a pack of generations we do keep a
          short record of it, because otherwise we could not give you what you paid for:{" "}
          {accountNumber} and how many sites are left on it. No email, no name and no card.{" "}
          That record
          lives in a key-value store, it is the only thing we hold about anybody, and it is
          deleted on request.
        </p>

        <h2>What we collect</h2>
        <p>
          Your sections, copy, colours, uploaded video and audio are held in your
          browser&apos;s local storage (IndexedDB) on your own device. Nothing there is
          sent anywhere on its own.
        </p>
        <p>
          Six things can leave your browser. Four of them carry nothing that identifies you; the other two are named as such below:
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
            <strong>A purchase, only if you buy more sites.</strong> The first two sites are free.{" "}
            {processor ? (
              <>
                A pack of five is paid for on {processor === "dodo" ? "Dodo Payments'" : "Stripe's"} own
                page, so the card details, the name, the email and the billing address go to
                them and never to us. They tell us that a payment was made and which account it
                was for. We keep how many sites are left on that account, and nothing else about
                the purchase.
              </>
            ) : (
              <>No packs are on sale on this deployment, so nothing is collected for one.</>
            )}
          </li>
          <li>
            <strong>Ordinary request logs.</strong> Our host records the usual server access
            logs, including IP addresses, which we also use to rate-limit the export,
            rewrite, counting, site-writing, licence and checkout endpoints so one visitor cannot exhaust them for
            everyone. Writing a site costs us real money per request, so that one is limited
            tightly: three a minute and twenty a day from one address.
          </li>
        </ul>
        <p>
          Uploaded video is <strong>never</strong> sent anywhere. Frames are extracted from
          it inside your browser.
        </p>
        <p>
          The Claude Code plugin runs on your own computer and sends nothing to ScrollCraft.
          The pages it builds load their typefaces from Google Fonts, as exports do.
        </p>

        <h2>Third-party services</h2>
        <ul>
          <li><strong>Vercel</strong> — hosting, and Web Analytics for the four counts above. Request logs may be retained under their policy.</li>
          <li><strong>Sentry</strong> — error reports, when enabled. These carry a stack trace, not your content.</li>
          <li><strong>Upstash</strong> — rate limiting and the daily counts above, when enabled. It stores a counter keyed by IP for limits, and counters keyed by date for the four steps.</li>
          <li><strong>Anthropic</strong> — writes a site from your description, when enabled. It receives that description and any photographs you attach, and only when you press Build my site.</li>
          {providers.includes("google") && (
            <li><strong>Google</strong>: sign-in, if you choose it. Google tells us your account number, your name, your email address and your profile picture; we keep only the number, and we keep it so your credits can find you in another browser. We never ask for access to your Gmail, Drive, contacts or anything else.</li>
          )}
          {providers.includes("github") && (
            <li><strong>GitHub</strong>: sign-in, if you choose it. GitHub tells us your account number, your username, your email address and your avatar; we keep only the number, and we keep it so your credits can find you in another browser. We never ask them for your repositories or anything else.</li>
          )}
          {processor === "dodo" && (
            <li><strong>Dodo Payments</strong> &mdash; the merchant of record for a pack of sites, when the shop is enabled. You pay on their page, so they receive your card, email and billing details directly and we do not. They tell us only that a payment succeeded and which account to credit.</li>
          )}
          {processor === "stripe" && (
            <li><strong>Stripe</strong> &mdash; payments, when the shop is enabled. You pay on their page, so they receive your card and billing details directly and we do not. They tell us only that a payment succeeded and which account to credit.</li>
          )}
          <li><strong>Sarvam AI</strong> — the rewrite assistant, when enabled. It receives the instruction you type and the copy of the site you are editing, and only when you press Rewrite.</li>
          <li><strong>Google Fonts</strong> — templates load webfonts, which discloses your IP to Google. Exported sites do the same unless you self-host the fonts.</li>
        </ul>

        <h2>Cookies</h2>
        <p>
          Two, both around the site writer and neither readable by scripts: a random name
          for this browser, so your free sites are yours rather than shared with everybody
          on the same network, and, if you buy a pack, the hash of your licence key so this
          browser can spend what you paid for. A third is set only while you are signed in,
          and holds the signed session. No advertising or analytics cookies
          are used. See our <Link href="/cookies" className="underline">Cookie Policy</Link>.
        </p>

        <h2>Your rights</h2>
        <p>
          If you never signed in, there is no account to delete and nothing of yours for us
          to hold. If you did, what we hold is {accountNumber} and how many of
          your paid sites are left; email <a href="mailto:hs1663531@gmail.com" className="underline">hs1663531@gmail.com</a> and
          it is deleted, along with any unused credits. To remove what
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
