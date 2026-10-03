# Deploying ScrollCraft

ScrollCraft has no database, no accounts and no payment provider, so a deploy is a
build. There is nothing to provision and no migration step.

## Vercel

```sh
npx vercel deploy --prod
```

Or connect the repository in the Vercel dashboard and accept the defaults — the
framework preset is Next.js and the build command is `next build`.

## Anywhere else that runs Node

```sh
npm install
npm run build
npm start
```

## Environment variables

**None are required.** The app boots with an empty environment. Everything in
[`.env.example`](../.env.example) is optional:

| Variable | Effect if unset |
| --- | --- |
| `SITE_URL` | `robots.txt`, the sitemap and canonical URLs fall back to the public deployment URL |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Rate limiting falls back to an in-memory store, correct for a single instance |
| `FUNNEL_TOKEN` | `GET /api/count` answers 404; the daily counts are still written, but only readable from the Upstash console |
| `NEXT_PUBLIC_SENTRY_DSN` | Error reporting is disabled |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Source maps are not uploaded; stack traces stay minified |

## Measuring an export

Before shipping a change that touches the exporter, a template or the engine, measure a
real export rather than trusting that it is still fine:

```sh
npm run build && npx next start -p 3000 &
npm run check:export -- --slug weft --base http://127.0.0.1:3000
```

It exports that template through the running app, serves the result as a plain folder the
way anybody would host it, runs Lighthouse against that, and exits non-zero under 95
performance or 100 accessibility. Measured on 3 October 2026: kept, aurabeauty, weft and
orbitcrm each score 100 performance, 100 accessibility, 100 SEO and 96 best practices.

## Checking a deploy

`GET /api/health` returns `200` with `{"status":"ok"}`. It reports configuration only —
there is no database to probe.

```sh
curl -s https://<your-domain>/api/health
```

A `503` with `config: invalid` means a variable that *is* set failed validation. The
response names the offending variable outside production; in production it is logged
rather than returned.

## What the deployed app does and does not do

- It serves the marketing pages, the template gallery and the editor.
- It runs two API routes: `/api/export-site`, which turns section data into HTML, and
  `/api/demo-frame`, which draws the placeholder background.
- It stores nothing. Work in progress lives in the visitor's browser; exports are
  generated on demand and never written to disk.

That last point is the operational one: there is no backup to take, because there is no
state to lose.
