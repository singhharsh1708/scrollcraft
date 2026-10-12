"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Buy a pack, or tell this browser which pack is yours.
 *
 * The key is the whole of the account. It is in the receipt email, it works on any
 * machine you paste it into, and what the browser keeps is a cookie holding its hash
 * rather than the key itself.
 */
export default function KeyBox({ checkout }: { checkout: string }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/credits")
      .then((r) => r.json())
      .then((body: { hasKey?: boolean; remaining?: number }) => {
        if (live && body.hasKey) setRemaining(body.remaining ?? 0);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const redeem = async () => {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/credits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage(body.error || "That key was not recognised.");
        return;
      }
      setRemaining(body.remaining ?? 0);
      setKey("");
      setMessage(`${body.remaining} ${body.remaining === 1 ? "site" : "sites"} on this browser.`);
    } catch {
      setMessage("Could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-8">
      {checkout ? (
        <a href={checkout} className="lc-btn lc-btn-solid lc-btn-sm">
          Buy five sites
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">
          The shop is not open on this deployment yet.
        </p>
      )}

      <div className="mt-6 border-t border-border pt-6">
        <label htmlFor="licence" className="lc-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Already bought a pack?
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <Input
            id="licence"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste the key from your receipt"
            className="h-11 min-w-0 flex-1 bg-background font-mono text-sm"
          />
          <Button onClick={redeem} disabled={busy || key.trim().length < 8} variant="outline" className="h-11">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Use it here"}
          </Button>
        </div>
        {remaining !== null && !message && (
          <p className="mt-3 text-sm text-muted-foreground">
            {remaining} {remaining === 1 ? "site" : "sites"} left on this browser.
          </p>
        )}
        {message && (
          <p role="status" className="mt-3 text-sm text-foreground">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
