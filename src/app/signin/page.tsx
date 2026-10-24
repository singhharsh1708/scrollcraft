import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import GitHubMark from "@/components/GitHubMark";
import GoogleMark from "@/components/GoogleMark";
import { pageMeta } from "@/lib/pageMeta";
import { authConfigured, configuredProviders, PROVIDER_NAMES } from "@/auth";
import { signInWith } from "./actions";
import { safeNext } from "./next";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Sign in",
    description: "Sign in so a pack of sites follows you to any browser.",
    path: "/signin",
  }),
  robots: { index: false, follow: true },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const next = safeNext((await searchParams).next);
  const providers = authConfigured() ? configuredProviders() : [];

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <section aria-labelledby="signin-title" className="mx-auto w-full max-w-md flex-1 px-6 pb-24 pt-20">
        <h1 id="signin-title" className="lc-display text-4xl md:text-5xl">Sign in</h1>

        {providers.length > 0 ? (
          <>
            <p className="mt-5 text-muted-foreground">
              Signing in keeps a pack of sites on your account, so it reaches you in any browser.
              Nothing else here needs an account.
            </p>
            <ul className="mt-10 space-y-3">
              {providers.map((provider, i) => (
                <li key={provider}>
                  <form action={signInWith.bind(null, provider, next)}>
                    <button
                      type="submit"
                      className={`lc-btn ${i === 0 ? "lc-btn-solid" : "lc-btn-ghost"} w-full`}
                    >
                      {provider === "google" ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white">
                          <GoogleMark className="h-4 w-4" />
                        </span>
                      ) : (
                        <GitHubMark className="h-4 w-4" />
                      )}
                      Continue with {PROVIDER_NAMES[provider]}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-muted-foreground">
              We keep only your account number and how many sites are left on it. No email and
              no name. The{" "}
              <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
                privacy policy
              </Link>{" "}
              says it in full.
            </p>
          </>
        ) : (
          <p className="mt-5 text-muted-foreground">
            Sign-in is not offered on this deployment. Everything else works without an account.{" "}
            <Link href="/" className="underline underline-offset-4 hover:text-foreground">
              Back to the home page
            </Link>
          </p>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
