/**
 * An email signup form that posts straight to the site owner's email provider.
 *
 * An export is static files with no server to receive a submission, so the form's action
 * is the provider's own endpoint and the page needs no script. The owner pastes one URL;
 * which provider it is, the name its email field must carry and any hidden field it
 * requires are read off that URL, from each provider's own documentation.
 */
export type SignupForm = {
  action: string;
  emailName: string;
  hidden: [string, string][];
  provider: string | null;
};

export type SignupStatus =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "unsupported"; provider: string; reason: string }
  | { kind: "ok"; provider: string | null; note?: string };

type Provider = {
  name: string;
  match: (u: URL) => boolean;
  emailName?: string;
  hidden?: (u: URL) => [string, string][];
  /** Something the owner should know before relying on it. */
  note?: string;
  /** Why a plain form cannot work with this provider at all. */
  unsupported?: string;
};

/** The providers the editor names when it asks for a URL. */
export const SIGNUP_PROVIDER_NAMES = "Mailchimp, Kit, Buttondown or Formspree";

export const SIGNUP_PROVIDERS: Provider[] = [
  {
    // mailchimp.com/help/troubleshooting-the-embedded-signup-form: the embedded form posts
    // EMAIL; host-your-own-signup-forms passes the account and audience as u and id.
    name: "Mailchimp",
    match: (u) => u.hostname.endsWith(".list-manage.com") && u.pathname.startsWith("/subscribe/post"),
    emailName: "EMAIL",
    hidden: (u) =>
      (["u", "id"] as const).flatMap((k): [string, string][] => {
        const v = u.searchParams.get(k);
        return v ? [[k, v]] : [];
      }),
  },
  {
    // Kit's official convertkit-react templates post email_address to /forms/<id>/subscriptions.
    name: "Kit",
    match: (u) => /^app\.(convertkit|kit)\.com$/.test(u.hostname) && /^\/forms\/[^/]+\/subscriptions\/?$/.test(u.pathname),
    emailName: "email_address",
  },
  {
    // docs.buttondown.com: a plain form meant for static sites, email plus a hidden embed=1.
    name: "Buttondown",
    match: (u) => u.hostname === "buttondown.com" && u.pathname.startsWith("/api/emails/embed-subscribe/"),
    emailName: "email",
    hidden: () => [["embed", "1"]],
  },
  {
    // formspree.io/html: accepts any field, and one called email becomes the reply-to.
    name: "Formspree",
    match: (u) => u.hostname === "formspree.io" && u.pathname.startsWith("/f/"),
    emailName: "email",
    note: "it emails you each signup rather than adding it to a list",
  },
  {
    // loops.so/docs/forms/custom-form: answers a plain post with JSON rather than a page.
    name: "Loops",
    match: (u) => u.hostname === "app.loops.so" && u.pathname.startsWith("/api/newsletter-form/"),
    emailName: "email",
    note: "visitors will see its raw JSON reply after signing up",
  },
  {
    // beehiiv.com/support: its subscribe forms are a script embed only.
    name: "beehiiv",
    match: (u) => u.hostname === "beehiiv.com" || u.hostname.endsWith(".beehiiv.com"),
    unsupported: "its forms only work as a script embed, which an exported page does not run",
  },
];

function parse(url: string | null | undefined): URL | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

export function signupStatus(url: string | null | undefined): SignupStatus {
  if (!url?.trim()) return { kind: "empty" };
  const u = parse(url);
  if (!u) return { kind: "invalid" };
  const p = SIGNUP_PROVIDERS.find((x) => x.match(u));
  if (p?.unsupported) return { kind: "unsupported", provider: p.name, reason: p.unsupported };
  return { kind: "ok", provider: p?.name ?? null, note: p?.note };
}

/** The form to render, or null when there is nothing a plain form could post to. */
export function signupForm(url: string | null | undefined): SignupForm | null {
  const u = parse(url);
  if (!u) return null;
  const p = SIGNUP_PROVIDERS.find((x) => x.match(u));
  if (p?.unsupported) return null;
  return { action: u.toString(), emailName: p?.emailName ?? "email", hidden: p?.hidden?.(u) ?? [], provider: p?.name ?? null };
}
