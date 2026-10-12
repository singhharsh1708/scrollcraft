"use client";
import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import GitHubMark from "@/components/GitHubMark";
import { startGitHubSignIn } from "@/app/signin/actions";

/**
 * What somebody sees the moment the free site is gone.
 *
 * This is the only point in the product where money is asked for, so it is the one
 * place that has to be plain: what ran out, what a pack costs, and the two ways to
 * carry one. Signing in is offered here rather than only in the nav, because here is
 * where it means something: a pack bought on a phone reaches a laptop.
 */
export default function OutOfCredits({
  message,
  canSignIn,
  signedIn,
}: {
  message: string;
  canSignIn: boolean;
  signedIn: boolean;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div
      role="alert"
      className="mt-6 rounded-2xl border border-primary-ink/30 bg-card p-6 shadow-[var(--lift-2)]"
    >
      <p className="text-foreground">{message}</p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/pricing" className="lc-btn lc-btn-solid lc-btn-sm">
          See what a pack costs
        </Link>
        {canSignIn && !signedIn && (
          <form action={startGitHubSignIn} onSubmit={() => setBusy(true)}>
            <button type="submit" className="lc-btn lc-btn-ghost lc-btn-sm" disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <GitHubMark className="h-4 w-4" />
              )}
              Sign in with GitHub
            </button>
          </form>
        )}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {signedIn
          ? "A pack bought now lands on your account, so it reaches you in any browser you sign in on."
          : canSignIn
            ? "Already bought a pack? Sign in and it follows you here. You can also paste the licence key on the pricing page."
            : "Already bought a pack? Paste the licence key on the pricing page."}
      </p>
    </div>
  );
}
