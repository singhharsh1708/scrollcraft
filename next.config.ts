import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // 'unsafe-eval' stays: JSZip's bundled shims call it behind a try/catch, and the
      // export path has not been verified without it.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      // data: is required — the editor reads an uploaded track with readAsDataURL, so
      // without it every upload is blocked by CSP and scroll audio silently never plays.
      "media-src 'self' blob: data:",
      "connect-src 'self' https://*.sentry.io",
      "font-src 'self' https://fonts.gstatic.com",
      // Nothing here frames anything, and nothing may frame it.
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

// The example bundles are plain static directories under public/. Next serves
// `/examples/<slug>/index.html` but not `/examples/<slug>`, which is the URL a person
// types. This has to be a redirect, not a rewrite: the bundles reference their frames
// relatively, so serving index.html under the shorter URL resolves `frames/frame_0000.jpg`
// against `/examples/` and every frame 404s. That renders a black canvas and logs nothing,
// which is the one failure the bundle contract calls out by name. Listed by slug so the
// rule cannot shadow the gallery route or public/examples/built.json.
const EXAMPLE_SLUGS: string[] = JSON.parse(
  readFileSync(new URL("./examples/manifest.json", import.meta.url), "utf8")
).map((e: { slug: string }) => e.slug);

const nextConfig: NextConfig = {
  async redirects() {
    return [
      ...EXAMPLE_SLUGS.map((slug) => ({
        source: `/examples/${slug}`,
        destination: `/examples/${slug}/index.html`,
        permanent: false,
      })),
      { source: "/showcase", destination: "/templates", permanent: true },
      { source: "/demos", destination: "/templates", permanent: true },
      { source: "/demos/:slug", destination: "/templates/:slug", permanent: true },
      // A Product Hunt landing page that outlived its launch. It advertised a live
      // campaign, 30% off plans that no longer exist, and invented testimonials.
      // Redirected rather than 404'd so any inbound link still lands somewhere real.
      { source: "/launch", destination: "/templates", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: true,
  },
});
