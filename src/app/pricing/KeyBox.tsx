"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import BuyPack, { TOTAL_BEFORE_KEY } from "@/components/BuyPack";

/**
 * Buy a pack and see what is left. Buying goes through an account, so the pack is there
 * wherever its owner signs in.
 */

type Credits = {
  hasKey?: boolean;
  remaining?: number;
  total?: number;
  signedIn?: boolean;
  canSignIn?: boolean;
  canBuy?: boolean;
};

/** How long to wait for a payment's webhook before saying so plainly. */
const CONFIRM_TRIES = 10;
const CONFIRM_EVERY_MS = 1500;

export default function KeyBox({ checkout }: { checkout: string }) {
  const [credits, setCredits] = useState<Credits | null>(null);
  const [confirming, setConfirming] = useState<"no" | "waiting" | "landed" | "slow" | "failed">("no");

  useEffect(() => {
    let live = true;
    const params = new URLSearchParams(window.location.search);
    // Dodo sends the buyer back here whether or not the payment went through.
    const failed = params.get("status") === "failed" || params.get("status") === "cancelled";
    const justBought = params.get("bought") === "1";
    // What the balance was before the buyer left for the checkout, written by the Buy button.
    // Without it there is no telling a pack that has just landed from one already there.
    let before: number | null = null;
    try {
      const stored = sessionStorage.getItem(TOTAL_BEFORE_KEY);
      before = stored === null ? null : Number(stored);
    } catch {
      // Storage refused: fall back to "any credits at all".
    }
    let tries = 0;

    const read = async () => {
      try {
        const body = (await (await fetch("/api/credits", { cache: "no-store" })).json()) as Credits;
        if (!live) return;
        setCredits(body);
        if (!justBought) return;
        if (failed) {
          setConfirming("failed");
          return;
        }

        // The buyer gets back before the webhook does. The checkout has the money and the
        // credits arrive a moment later, so the page waits for them rather than showing
        // a balance that looks as though the purchase did nothing.
        const total = body.total ?? 0;
        const landed = before === null ? total > 0 : total > before;
        if (landed) {
          try {
            sessionStorage.removeItem(TOTAL_BEFORE_KEY);
          } catch {
            // Nothing to clear.
          }
          setConfirming("landed");
          return;
        }
        tries += 1;
        if (tries >= CONFIRM_TRIES) {
          setConfirming("slow");
          return;
        }
        setConfirming("waiting");
        window.setTimeout(read, CONFIRM_EVERY_MS);
      } catch {
        // A failed read leaves whatever was last shown.
      }
    };
    void read();

    return () => {
      live = false;
    };
  }, []);

  const signedIn = Boolean(credits?.signedIn);
  const remaining = credits?.hasKey ? credits.remaining ?? 0 : null;

  return (
    <div className="mt-8">
      {confirming === "waiting" && (
        <p role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-border bg-background p-4 text-sm text-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Payment received. Adding your five sites.
        </p>
      )}
      {confirming === "landed" && (
        <p role="status" className="mb-5 rounded-xl border border-primary-ink/40 bg-background p-4 text-sm text-foreground">
          Payment received. {credits?.remaining ?? 0} {credits?.remaining === 1 ? "site is" : "sites are"} on your account.{" "}
          <a href="/describe" className="underline underline-offset-4">
            Write one now
          </a>
        </p>
      )}
      {confirming === "failed" && (
        <p role="status" className="mb-5 rounded-xl border border-border bg-background p-4 text-sm text-foreground">
          The payment did not go through, so nothing was charged. You can try again below.
        </p>
      )}
      {confirming === "slow" && (
        <p role="status" className="mb-5 rounded-xl border border-border bg-background p-4 text-sm text-foreground">
          Payment received, and the credits are taking longer than usual to arrive. Reload this page in a minute. If
          they are still missing, email us with your receipt and we will add them by hand.
        </p>
      )}

      {credits?.canBuy ? (
        <BuyPack signedIn={signedIn} canSignIn={Boolean(credits.canSignIn)} next="/pricing" />
      ) : checkout ? (
        <a href={checkout} className="lc-btn lc-btn-solid lc-btn-sm">
          Buy five sites
        </a>
      ) : (
        credits && <p className="text-sm text-muted-foreground">The shop is not open on this deployment yet.</p>
      )}

      {remaining !== null && confirming === "no" && (
        <p className="mt-4 text-sm text-muted-foreground">
          {remaining} {remaining === 1 ? "site" : "sites"} left {signedIn ? "on your account" : "on this browser"}.
        </p>
      )}

    </div>
  );
}
