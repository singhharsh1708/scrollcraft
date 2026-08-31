/**
 * Sentry on the client, only when there is somewhere to send to.
 *
 * `enabled: !!dsn` stopped it reporting but not shipping: the SDK was a static import,
 * so every page of every deployment downloaded it whether or not a DSN existed. No DSN
 * is set on this project, and a fork has none by definition.
 *
 * NEXT_PUBLIC_ values are inlined at build time, so a build without a DSN compiles the
 * branch below away and the SDK never enters the bundle.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

type CaptureRouterTransitionStart = (href: string, navigationType: string) => void;
let capture: CaptureRouterTransitionStart | undefined;

if (dsn) {
  import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.5"),
        debug: false,
      });
      capture = Sentry.captureRouterTransitionStart;
    })
    .catch(() => {
      // Losing error reporting must never take the app with it.
    });
}

/**
 * Next 16 calls this on client-side navigations, and needs it to exist synchronously, so
 * it forwards to the SDK once the import above resolves. Navigations before that are not
 * traced, which was already true while the SDK was loading.
 */
export const onRouterTransitionStart: CaptureRouterTransitionStart = (href, navigationType) => {
  capture?.(href, navigationType);
};
