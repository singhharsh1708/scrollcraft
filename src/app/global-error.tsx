"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Something went wrong</h2>
          <p className="text-white/60">We&apos;ve been notified and are looking into it.</p>
          <button
            onClick={reset}
            className="px-6 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg font-medium transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
