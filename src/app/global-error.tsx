"use client";
import { useEffect } from "react";
import { captureClientError } from "@/lib/captureClientError";

/**
 * The last-resort error page. It replaces the root layout, so it cannot count on the
 * global stylesheet having loaded; the styles are inline for that reason.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    captureClientError(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#030710",
          color: "#e5f4ff",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "0 24px" }}>
          <h2 style={{ margin: 0, fontSize: 40, fontWeight: 300, letterSpacing: "-0.03em" }}>
            Something went wrong
          </h2>
          <p style={{ margin: "16px 0 32px", color: "#93a9c0", fontSize: 18 }}>Reloading usually clears it.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              height: 48,
              padding: "0 24px",
              border: 0,
              borderRadius: 4,
              background: "#e5f4ff",
              color: "#030710",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
