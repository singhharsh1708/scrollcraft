import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Without this Next never hands server-side errors to Sentry, so every 500 from a
// route handler or Server Component was invisible — only client errors reported.
export const onRequestError = Sentry.captureRequestError;
