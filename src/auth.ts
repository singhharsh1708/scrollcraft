import "server-only";
import type { DefaultSession, NextAuthResult } from "next-auth";
import { githubIdentity, googleIdentity } from "@/lib/credits";
import { logger } from "@/lib/logger";

/**
 * Sign in with Google or GitHub, so credits follow the buyer rather than the browser.
 *
 * There is no database, so the session is a signed cookie and the only thing kept from
 * either provider is the account number. Not the login or the email: either can be
 * changed and the freed one claimed by somebody else, which would hand a stranger the credits.
 *
 * Every variable is optional, like everything else in this app's environment. A provider
 * is offered only when both of its variables are set, and with no provider or no
 * AUTH_SECRET nothing is mounted and every route behaves as it did before this existed.
 */

export type SignInProvider = "google" | "github";

/** Configured providers, Google first: most buyers have a Google account and no GitHub one. */
export function configuredProviders(): SignInProvider[] {
  const providers: SignInProvider[] = [];
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) providers.push("google");
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) providers.push("github");
  return providers;
}

export function authConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET) && configuredProviders().length > 0;
}

export const PROVIDER_NAMES: Record<SignInProvider, string> = { google: "Google", github: "GitHub" };

/** "Google or GitHub", "Google", "GitHub", or "" when sign-in is off. */
export function providerNames(): string {
  return authConfigured() ? configuredProviders().map((p) => PROVIDER_NAMES[p]).join(" or ") : "";
}

declare module "next-auth" {
  interface Session {
    user: { provider?: string; accountId?: string } & DefaultSession["user"];
  }
}

let instance: NextAuthResult | null = null;

/**
 * Auth.js, built on first use.
 *
 * Imported here rather than at the top of the file so a deployment with no sign-in never
 * loads it at all: the two routes that ask who is signed in are on the path of every
 * generation, and on a fresh clone they should cost what they always did.
 */
export async function authInstance(): Promise<NextAuthResult> {
  if (!instance) {
    const wanted = configuredProviders();
    const [{ default: NextAuth }, google, github] = await Promise.all([
      import("next-auth"),
      wanted.includes("google") ? import("next-auth/providers/google") : null,
      wanted.includes("github") ? import("next-auth/providers/github") : null,
    ]);
    instance = NextAuth({
      providers: [google?.default, github?.default].filter((p) => p !== undefined),
      // Auth.js refuses a host nothing told it to trust, and answers 500 to every one of
      // its own endpoints until something does. The provider sends the callback only to
      // the URL registered against the app, whatever host a request claims.
      trustHost: true,
      // No adapter, so there is nowhere to keep a session row.
      session: { strategy: "jwt" },
      callbacks: {
        jwt({ token, account }) {
          if (account?.provider && account.providerAccountId) {
            token.provider = account.provider;
            token.accountId = account.providerAccountId;
          }
          delete token.email;
          delete token.name;
          return token;
        },
        session({ session, token }) {
          // A token's claims are untyped, so this is where they become strings again.
          if (typeof token?.provider === "string" && typeof token.accountId === "string") {
            session.user.provider = token.provider;
            session.user.accountId = token.accountId;
          } else if (typeof token?.githubId === "string") {
            // Sessions issued before Google sign-in existed carry only this claim.
            session.user.provider = "github";
            session.user.accountId = token.githubId;
          }
          return session;
        },
      },
    });
  }
  return instance;
}

/** The credits identity for a provider's account id: "gh:<id>" for GitHub, "go:<sub>" for Google. */
export function identityFor(provider: string | undefined, accountId: string | undefined): string | null {
  if (!accountId) return null;
  if (provider === "github") return githubIdentity(accountId);
  if (provider === "google") return googleIdentity(accountId);
  return null;
}

/**
 * The identity this request's credits hang off, or null when nobody is signed in.
 *
 * A session that cannot be read falls back to null rather than throwing, which leaves
 * the visitor on the licence-key cookie instead of refusing them a site they paid for.
 */
export async function accountIdentity(): Promise<string | null> {
  if (!authConfigured()) return null;
  try {
    const session = await (await authInstance()).auth();
    return identityFor(session?.user?.provider, session?.user?.accountId);
  } catch (err) {
    logger.error("auth: could not read the session", { err });
    return null;
  }
}
