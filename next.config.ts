import type { NextConfig } from "next";
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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      // data: is required — the editor reads an uploaded track with readAsDataURL, so
      // without it every upload is blocked by CSP and scroll audio silently never plays.
      "media-src 'self' blob: data:",
      "connect-src 'self' https://checkout.razorpay.com https://*.sentry.io",
      "frame-src https://api.razorpay.com https://checkout.razorpay.com",
      "font-src 'self' https://fonts.gstatic.com",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async redirects() {
    return [
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
