"use client";
import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import GitHubMark from "@/components/GitHubMark";
import BuyPack from "@/components/BuyPack";
import { signInAndReturn } from "@/app/signin/actions";

/**
 * What somebody sees the moment the free sites are gone.
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
  canBuy,
}: {
  message: string;
  canSignIn: boolean;
  signedIn: boolean;
  /** Whether a pack can be bought on this deployment at all. */
  canBuy: boolean;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div
      role="alert"
      className="mt-6 rounded-2xl border border-primary-ink/30 bg-card p-6 shadow-[var(--lift-2)]"
    >
      <p className="text-foreground">{message}</p>

      <div className="mt-5 flex flex-wrap items-start gap-3">
        {canBuy ? (
          <BuyPack signedIn={signedIn} canSignIn={canSignIn} next="/describe" />
        ) : (
          <Link href="/pricing" className="lc-btn lc-btn-solid lc-btn-sm">
            See what a pack costs
          </Link>
        )}
        {canBuy && (
          <Link href="/pricing" className="lc-btn lc-btn-ghost lc-btn-sm">
            What a pack includes
          </Link>
        )}
        {!canBuy && canSignIn && !signedIn && (
          <form action={signInAndReturn} onSubmit={() => setBusy(true)}>
            <input type="hidden" name="next" value="/describe" />
            <button type="submit" className="lc-btn lc-btn-ghost lc-btn-sm" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <GitHubMark className="h-4 w-4" />}
              Sign in with GitHub
            </button>
          </form>
        )}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {signedIn
          ? "Five sites for $20, paid once. They land on your account and reach you in any browser you sign in on."
          : canSignIn
            ? "Five sites for $20, paid once. Signing in first means the pack is yours on any machine, and if you already bought one it follows you here."
            : "Already bought a pack? Paste the licence key on the pricing page."}
      </p>
    </div>
  );
}
