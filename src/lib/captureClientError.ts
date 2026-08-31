"use client";

/**
 * Report a client error, if there is anywhere to send it.
 *
 * The error boundaries imported the SDK statically, and global-error.tsx is in the root
 * client graph, so that put Sentry in the chunk every page loads whether or not a DSN
 * existed. NEXT_PUBLIC_ values are inlined at build time, so a build with no DSN compiles
 * the import away.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export function captureClientError(error: unknown): void {
  if (!dsn) return;
  import("@sentry/nextjs")
    .then((Sentry) => Sentry.captureException(error))
    .catch(() => {
      // Losing the report must never replace the error the user is already looking at.
    });
}
