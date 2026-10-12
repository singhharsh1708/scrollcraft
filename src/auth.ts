import "server-only";
import type { DefaultSession, NextAuthResult } from "next-auth";
import { githubIdentity } from "@/lib/credits";
import { logger } from "@/lib/logger";

/**
 * Sign in with GitHub, so credits follow the buyer rather than the browser.
 *
 * There is no database, so the session is a signed cookie and the only thing kept from
 * GitHub is the numeric account id. Not the login: a username can be changed and the
 * freed one claimed by somebody else, which would hand a stranger the credits.
 *
 * All three variables are optional, like everything else in this app's environment.
 * With any of them missing nothing is mounted, the nav offers no sign-in, and every
 * route behaves as it did before this existed.
 */

export function authConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);
}

declare module "next-auth" {
  interface Session {
    user: { githubId?: string } & DefaultSession["user"];
  }
}

let instance: NextAuthResult | null = null;

/**
 * Auth.js, built on first use.
 *
 * Imported here rather than at the top of the file so a deployment with no GitHub app
 * never loads it at all: the two routes that ask who is signed in are on the path of
 * every generation, and on a fresh clone they should cost what they always did.
 */
export async function authInstance(): Promise<NextAuthResult> {
  if (!instance) {
    const [{ default: NextAuth }, { default: GitHub }] = await Promise.all([
      import("next-auth"),
      import("next-auth/providers/github"),
    ]);
    instance = NextAuth({
      providers: [GitHub],
      // Auth.js refuses a host nothing told it to trust, and answers 500 to every one of
      // its own endpoints until something does. Only GitHub decides where the callback
      // lands — it goes to the URL registered against the OAuth app, whatever host a
      // request claims — so the forwarded host is not what is holding this up.
      trustHost: true,
      // No adapter, so there is nowhere to keep a session row.
      session: { strategy: "jwt" },
      callbacks: {
        jwt({ token, account }) {
          if (account?.providerAccountId) token.githubId = account.providerAccountId;
          return token;
        },
        session({ session, token }) {
          // A token's claims are untyped, so this is where the id becomes a string again.
          if (typeof token?.githubId === "string") session.user.githubId = token.githubId;
          return session;
        },
      },
    });
  }
  return instance;
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
    const id = session?.user?.githubId;
    return id ? githubIdentity(id) : null;
  } catch (err) {
    logger.error("auth: could not read the session", { err });
    return null;
  }
}
