// Lightweight auth config — no Prisma, no Node.js-only modules.
// Used by middleware (Edge Runtime) and merged into the full auth.ts config.
import type { NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

// Only register a provider if its credentials are present, so the sign-in page
// (via getProviders) shows exactly the providers that are actually configured.
const providers: Provider[] = [];

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    })
  );
}

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
  );
}

export default {
  providers,
  pages: {
    signIn: "/auth/signin",
  },
} satisfies NextAuthConfig;
