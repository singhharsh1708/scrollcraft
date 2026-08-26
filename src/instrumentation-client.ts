import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.5"),
  debug: false,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});

// Next 16 calls this on client-side navigations. Without it, router transitions are
// missing from traces even once the SDK is loading.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
