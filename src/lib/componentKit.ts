/**
 * Sections you can copy into any page.
 *
 * Plain HTML and CSS. No React, no Tailwind, no bundler, nothing to install: the kits
 * people compare us to all ship React plus a motion library, and the ones that serve
 * everyone else ship markup with no behaviour at all. These paste into a WordPress block,
 * a PHP template or a folder of static files and work, which is the same promise the
 * export already makes.
 *
 * One definition per section, used by the page that shows it and by the copy button, so
 * what somebody reads and what they paste cannot drift apart.
 */

export type KitComponent = {
  id: string;
  name: string;
  /** What it is for, in the words of someone deciding whether to use it. */
  description: string;
  html: string;
  css: string;
};

/**
 * The colours and spacing every section reads, each with a fallback, so a pasted block
 * inherits the host page's palette where there is one and still looks finished where
 * there is not.
 */
export const KIT_TOKENS = `:root {
  --sck-ground: #0b1020;
  --sck-surface: #141b31;
  --sck-ink: #f4f7fb;
  --sck-muted: #b9c4d9;
  --sck-accent: #3b5bdb;
  --sck-accent-ink: #ffffff;
  --sck-line: rgba(244, 247, 251, 0.14);
  --sck-field: rgba(0, 0, 0, 0.25);
  --sck-radius: 10px;
  --sck-measure: 62ch;
  --sck-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}`;

/** The same tokens for a light page, so a block can be checked on either ground. */
export const KIT_TOKENS_LIGHT = `:root {
  --sck-ground: #ffffff;
  --sck-surface: #f2f5fb;
  --sck-ink: #0f1420;
  --sck-muted: #333c4d;
  --sck-accent: #2340b8;
  --sck-accent-ink: #ffffff;
  --sck-line: rgba(15, 20, 32, 0.16);
  --sck-field: rgba(15, 20, 32, 0.04);
  --sck-radius: 10px;
  --sck-measure: 62ch;
  --sck-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}`;

/** Shared by every section: the base type, focus ring and spacing rhythm. */
export const KIT_BASE = `.sck {
  font-family: var(--sck-font);
  color: var(--sck-ink);
  background: var(--sck-ground);
  padding: clamp(2.5rem, 6vw, 5rem) 1.25rem;
}
.sck * { box-sizing: border-box; }
.sck-inner { margin: 0 auto; max-width: 68rem; }
.sck h2 { font-size: clamp(1.75rem, 4vw, 2.75rem); line-height: 1.15; margin: 0 0 1rem; letter-spacing: -0.02em; }
.sck h3 { font-size: 1.125rem; line-height: 1.3; margin: 0 0 0.5rem; }
.sck p { color: var(--sck-muted); line-height: 1.65; margin: 0 0 1rem; max-width: var(--sck-measure); }
.sck a:focus-visible, .sck button:focus-visible, .sck input:focus-visible, .sck summary:focus-visible {
  outline: 3px solid var(--sck-accent); outline-offset: 3px; border-radius: 4px;
}
.sck-btn {
  display: inline-block; padding: 0.85rem 1.5rem; border-radius: var(--sck-radius);
  background: var(--sck-accent); color: var(--sck-accent-ink); text-decoration: none;
  font-weight: 600; border: 0; cursor: pointer; font-size: 1rem;
}
.sck-btn-quiet { background: transparent; color: var(--sck-ink); border: 1px solid var(--sck-line); }`;

export const KIT: KitComponent[] = [
  {
    id: "hero",
    name: "Hero",
    description: "The opening screen: what you do, who it is for, and the one thing to click.",
    html: `<section class="sck sck-hero">
  <div class="sck-inner">
    <h2>Bookkeeping that closes your month in a morning</h2>
    <p>Riverbank keeps the books for 340 independent cafes and studios. Your accounts reconcile nightly, so the quarter ends when the quarter ends.</p>
    <div class="sck-hero-actions">
      <a class="sck-btn" href="#start">Start a trial</a>
      <a class="sck-btn sck-btn-quiet" href="#how">See how it works</a>
    </div>
  </div>
</section>`,
    css: `.sck-hero { padding-block: clamp(4rem, 12vw, 8rem); }
.sck-hero h2 { max-width: 20ch; }
.sck-hero p { font-size: 1.125rem; }
.sck-hero-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 2rem; }`,
  },
  {
    id: "features",
    name: "Feature grid",
    description: "Three things the product does, each with room for a sentence that is not a slogan.",
    html: `<section class="sck sck-features">
  <div class="sck-inner">
    <h2>What you get on day one</h2>
    <div class="sck-feature-grid">
      <article>
        <h3>Nightly reconciliation</h3>
        <p>Every transaction is matched against the bank feed overnight. You see what did not match, not a green tick that hides it.</p>
      </article>
      <article>
        <h3>One ledger, many outlets</h3>
        <p>Run four cafes from one set of books, with per-site margins that do not need a spreadsheet to read.</p>
      </article>
      <article>
        <h3>Your accountant already knows it</h3>
        <p>Exports in the format your practice files with, so the handover at year end is a file rather than a meeting.</p>
      </article>
    </div>
  </div>
</section>`,
    css: `.sck-feature-grid { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); margin-top: 2.5rem; }
.sck-feature-grid article { border-top: 1px solid var(--sck-line); padding-top: 1.25rem; }
.sck-feature-grid p { margin: 0; }`,
  },
  {
    id: "pricing",
    name: "Pricing",
    description: "Two or three plans, with the price where people look for it rather than behind a form.",
    html: `<section class="sck sck-pricing">
  <div class="sck-inner">
    <h2>Pricing</h2>
    <p>Billed monthly. Cancel from the settings page, not by email.</p>
    <div class="sck-plans">
      <article class="sck-plan">
        <h3>Single site</h3>
        <p class="sck-price"><strong>$29</strong> <span>per month</span></p>
        <ul>
          <li>One outlet, unlimited transactions</li>
          <li>Nightly reconciliation</li>
          <li>Year-end export</li>
        </ul>
        <a class="sck-btn sck-btn-quiet" href="#single">Choose single site</a>
      </article>
      <article class="sck-plan sck-plan-lead">
        <h3>Group</h3>
        <p class="sck-price"><strong>$79</strong> <span>per month</span></p>
        <ul>
          <li>Up to six outlets on one ledger</li>
          <li>Per-site margins</li>
          <li>Two accountant seats, free</li>
        </ul>
        <a class="sck-btn" href="#group">Choose group</a>
      </article>
    </div>
  </div>
</section>`,
    css: `.sck-plans { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); margin-top: 2.5rem; }
.sck-plan { background: var(--sck-surface); border-radius: var(--sck-radius); padding: 1.75rem; }
.sck-plan-lead { outline: 2px solid var(--sck-accent); }
.sck-price { color: var(--sck-ink); margin-bottom: 1.25rem; }
.sck-price strong { font-size: 2.25rem; letter-spacing: -0.02em; }
.sck-price span { color: var(--sck-muted); }
.sck-plan ul { list-style: none; margin: 0 0 1.75rem; padding: 0; }
.sck-plan li { color: var(--sck-muted); padding: 0.5rem 0; border-bottom: 1px solid var(--sck-line); }
.sck-plan li:last-child { border-bottom: 0; }`,
  },
  {
    id: "faq",
    name: "Questions",
    description: "The questions people actually ask before buying, answered without a support ticket.",
    html: `<section class="sck sck-faq">
  <div class="sck-inner">
    <h2>Before you ask</h2>
    <div class="sck-faq-list">
      <details>
        <summary>What happens to my data if I leave?</summary>
        <p>You download every transaction, invoice and attachment as CSV and PDF, from a button in settings. We keep nothing after 30 days.</p>
      </details>
      <details>
        <summary>Do you support my bank?</summary>
        <p>Every UK and Irish current account through open banking, and anything else by statement import. If your bank is missing, tell us and we will say yes or no within a day.</p>
      </details>
      <details>
        <summary>Can my accountant get in?</summary>
        <p>Two accountant seats are included on the group plan, with read access and the year-end export. They do not need to pay for anything.</p>
      </details>
    </div>
  </div>
</section>`,
    css: `.sck-faq-list { margin-top: 2rem; max-width: var(--sck-measure); }
.sck-faq details { border-bottom: 1px solid var(--sck-line); padding: 1rem 0; }
/* list-item, not flex: flex removes the disclosure triangle, which is the only
   thing telling someone the answer is in there. */
.sck-faq summary { cursor: pointer; font-weight: 600; font-size: 1.0625rem; display: list-item; padding: 0.4rem 0; }
.sck-faq details[open] summary { margin-bottom: 0.75rem; }
.sck-faq p { margin: 0; }`,
  },
  {
    id: "signup",
    name: "Email signup",
    description: "Collects an email through your own provider. Set the form's action to your Mailchimp, Kit, Buttondown or Formspree URL.",
    html: `<section class="sck sck-signup">
  <div class="sck-inner">
    <h2>Hear when it opens</h2>
    <p>One email when your invite is ready, and nothing else.</p>
    <form class="sck-signup-form" method="post" action="https://buttondown.com/api/emails/embed-subscribe/your-account" target="_blank" rel="noopener">
      <label for="sck-email">Email address</label>
      <input id="sck-email" type="email" name="email" required autocomplete="email" placeholder="you@example.com" />
      <button class="sck-btn" type="submit">Join the list</button>
    </form>
  </div>
</section>`,
    css: `.sck-signup-form { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; margin-top: 1.5rem; max-width: 34rem; }
.sck-signup-form label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.sck-signup-form input {
  flex: 1 1 15rem; min-width: 0; min-height: 48px; padding: 0 1rem; font: inherit; font-size: 1rem;
  color: var(--sck-ink); background: var(--sck-field); border: 1px solid var(--sck-line); border-radius: var(--sck-radius);
}
.sck-signup-form input::placeholder { color: var(--sck-muted); }
.sck-signup-form button { min-height: 48px; }
@media (max-width: 30rem) { .sck-signup-form button { flex: 1 1 100%; } }`,
  },
  {
    id: "footer",
    name: "Footer",
    description: "The end of the page: where to go next, how to get in touch, and the legal line.",
    html: `<footer class="sck sck-footer">
  <div class="sck-inner">
    <nav class="sck-footer-nav" aria-label="Footer">
      <a href="#pricing">Pricing</a>
      <a href="#security">Security</a>
      <a href="#status">Status</a>
      <a href="mailto:hello@example.com">hello@example.com</a>
    </nav>
    <p class="sck-footer-legal">Riverbank Books Ltd, registered in England 09182736. VAT GB 284 7261 55.</p>
  </div>
</footer>`,
    css: `.sck-footer { padding-block: 3rem; border-top: 1px solid var(--sck-line); }
.sck-footer-nav { display: flex; flex-wrap: wrap; gap: 1.25rem; margin-bottom: 1.25rem; }
.sck-footer-nav a { color: var(--sck-ink); text-decoration: none; border-bottom: 1px solid var(--sck-line); display: inline-flex; align-items: center; min-height: 32px; padding: 0 0 2px; }
.sck-footer-nav a:hover { border-bottom-color: currentColor; }
.sck-footer-legal { font-size: 0.9375rem; margin: 0; }`,
  },
];

export function kitComponent(id: string): KitComponent | undefined {
  return KIT.find((c) => c.id === id);
}

/** Everything a pasted section needs, for someone taking one block rather than the set. */
export function kitStylesheet(component: KitComponent): string {
  return `${KIT_TOKENS}\n\n${KIT_BASE}\n\n${component.css}`;
}

/** A whole page of the kit, for seeing the set together or one block on its own. */
export function kitPage(components: KitComponent[] = KIT, theme: "dark" | "light" = "dark"): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ScrollCraft components</title>
<style>
${theme === "light" ? KIT_TOKENS_LIGHT : KIT_TOKENS}

${KIT_BASE}

${components.map((c) => c.css).join("\n\n")}
</style>
</head>
<body style="margin:0; background: var(--sck-ground);">
${components.map((c) => c.html).join("\n")}
</body>
</html>`;
}
