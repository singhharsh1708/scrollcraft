"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import GitHubMark from "@/components/GitHubMark";
import { signInAndReturn } from "@/app/signin/actions";

/**
 * The one button that takes money.
 *
 * It does one of two things, and says which before it is pressed. Signed in, it opens
 * Stripe's checkout for a pack that will land on this account. Not signed in, it signs
 * in first and comes back here, because a pack has to belong to somebody before it is
 * paid for, or it ends up tied to a browser that can be cleared.
 */
/** Where the balance from before a purchase is kept, so the return can tell it landed. */
export const TOTAL_BEFORE_KEY = "scrollcraft_total_before";

export default function BuyPack({
  signedIn,
  canSignIn,
  next,
  className = "",
}: {
  signedIn: boolean;
  canSignIn: boolean;
  /** Where to come back to after signing in. A path on this site. */
  next: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const buy = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setError(body.error || "Could not open the checkout.");
        setBusy(false);
        return;
      }
      try {
        const now = (await (await fetch("/api/credits", { cache: "no-store" })).json()) as { total?: number };
        sessionStorage.setItem(TOTAL_BEFORE_KEY, String(now.total ?? 0));
      } catch {
        // Without it the return page falls back to "any credits at all".
      }
      // Left busy on purpose: the page is about to be replaced by Stripe's.
      window.location.assign(body.url);
    } catch {
      setError("Could not reach the server. Check your connection.");
      setBusy(false);
    }
  };

  if (!signedIn) {
    if (!canSignIn) return null;
    return (
      <form action={signInAndReturn} onSubmit={() => setBusy(true)} className={className}>
        <input type="hidden" name="next" value={next} />
        <button type="submit" disabled={busy} className="lc-btn lc-btn-solid lc-btn-sm">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <GitHubMark className="h-4 w-4" />}
          Sign in to buy five sites
        </button>
      </form>
    );
  }

  return (
    <div className={className}>
      <button type="button" onClick={buy} disabled={busy} className="lc-btn lc-btn-solid lc-btn-sm">
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {busy ? "Opening checkout…" : "Buy five sites for $20"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
