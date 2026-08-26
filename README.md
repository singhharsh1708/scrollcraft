<div align="center">

# ✦ ScrollCraft

**Ready-made cinematic scroll websites — no code, pure HTML.**

Pick a template, change the words, and export a production‑ready HTML/CSS/JS ZIP you can
deploy anywhere. The editor, publishing and ZIP export are free, along with 13 of the 21
templates. The other 8 are bought once, outright.

[Live demo](https://scrollcraft-gilt.vercel.app) · [Report a bug](https://github.com/singhharsh1708/scrollcraft/issues) · [Request a feature](https://github.com/singhharsh1708/scrollcraft/issues)

</div>

---

## What is ScrollCraft?

Apple‑style scroll animations (where the page scrubs through a sequence of frames as you
scroll) are gorgeous — and historically expensive. You either hire a studio, learn WebGL,
or ship a heavy JavaScript framework that tanks your Lighthouse score.

ScrollCraft removes all of that. You:

1. **Pick a template** — a finished scroll site with its own palette, typography, pacing and copy. Or upload your own video.
2. **Get frames** — the engine renders a sequence of canvas frames mapped to scroll position, in your browser.
3. **Edit visually** — change sections, copy, CTAs, audio and custom CSS.
4. **Publish** — one click gives the site a hosted link at `/s/your-site` you can send to anyone. No hosting account, no build step.
5. **Or export** — download a self‑contained ZIP (`index.html`, frames, audio). No runtime dependencies, deploys to any static host in under a minute.

## Features

- 🎨 **Generated scroll frames** — pick a style (gradient, geometric, particles, wave) and a palette; the frame sequence is rendered in-browser on canvas, no API key required.
- 🎬 **Scroll‑linked animation engine** — smooth canvas scrubbing, desktop + mobile frame sets.
- 🧩 **Template library** — 21 finished scroll sites across 11 categories, free on every plan, each with its own Google Fonts pairing and palette.
- 🌐 **One‑click publish** — every site gets a hosted link at `/s/your-site`; the background is regenerated in the visitor's browser, so a published site costs a database row, not megabytes.
- 📦 **Pure HTML export** — zero dependencies, zero lock‑in, deploy anywhere.
- 🎞️ **Bring your own video** — upload an MP4 or paste a URL; frames are extracted automatically.
- 🔊 **Scroll‑synced audio** — attach a soundtrack that responds to scroll position.
- 💳 **Payments** — Razorpay subscriptions (INR) + Lemon Squeezy one‑time purchases (global). Paid plans change how many websites you keep saved, not which templates you can use.
- 🔒 **Production‑grade** — rate limiting, structured logging, security headers, Sentry, Zod‑validated APIs.

## Two ways to use ScrollCraft

**Hosted app** — pick a template, edit it visually, then publish to a link or export a ZIP.
An account, a dashboard, and saved sites. See [Getting started](#getting-started) to run it.

**Claude Code skill** — build the same kind of site on your machine, in version control, with
generated backgrounds or your own footage. No account, no server, no payment.

Both emit the identical bundle layout (`index.html` + `frames/frame_0000.jpg` upward), so a
site built by the skill opens in the hosted editor and an exported ZIP can be rebuilt by the
skill.

### Installing the skill

This repository is also a Claude Code plugin marketplace. From inside Claude Code:

```
/plugin marketplace add singhharsh1708/scrollcraft
/plugin install scrollcraft@scrollcraft
```

Then just describe what you want — "build me a scroll site from hero.mp4" — and the skill
activates. To confirm it registered, run `/plugin` and look for `scrollcraft`.

Updating later:

```
/plugin marketplace update scrollcraft
```

### What the skill does

`ffmpeg` is the only external requirement (`brew install ffmpeg`, or `apt install ffmpeg`).
Everything else is plain Node with no dependencies.

Ask Claude for a scroll site, or drive it yourself:

```bash
# Fastest path — no footage needed. Scaffolds the spec, generates a
# background, and builds a working site in one command.
node scripts/init.mjs --name "Orrery" --style aurora
```

Or step by step:

```bash
# 1a. your own video -> frame sequence, desktop + mobile
node scripts/frames-from-video.mjs --input hero.mp4 --out frames \
  --fps 24 --width 1920 --mobile-width 828 --mobile-out frames-mobile

# 1b. or generate one: six cinematic styles, ~1MB instead of ~36MB
node scripts/frames-from-style.mjs --list
node scripts/frames-from-style.mjs --style nebula --count 180 \
  --width 1920 --mobile-width 828 --mobile-out frames-mobile

# 2. write scrollcraft.json describing your sections, then build
node scripts/build-site.mjs --spec scrollcraft.json --out dist

# 3. check the files, then check what actually renders
node scripts/doctor.mjs --spec scrollcraft.json
node scripts/verify.mjs --dir dist --shots shots
node scripts/serve.mjs --dir dist --port 4321
```

`verify.mjs` drives headless Chrome over the DevTools Protocol with no npm dependencies,
scrolls the built page, and measures the frames a reader actually sees: that the canvas
paints, that it advances, and that every line of copy clears 4.5:1 contrast against the
pixels behind it. It catches the failure that matters — a missing frame set renders a black
canvas, throws nothing, and logs nothing.

Two slash commands come with the plugin: `/scrollcraft-new` to start a site and
`/scrollcraft-build` to rebuild, check and preview one.

`dist/` is a static directory with no runtime dependencies and no external requests. Deploy it
anywhere.

Skill source lives in [plugins/scrollcraft/](plugins/scrollcraft/); the bundle invariants both
halves rely on are written down in
[references/export-contract.md](plugins/scrollcraft/skills/scrollcraft/references/export-contract.md).

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js 16](https://nextjs.org) (App Router) · React · TypeScript |
| Styling | Tailwind CSS v4 · [shadcn/ui](https://ui.shadcn.com) |
| Auth | [Auth.js (NextAuth v5)](https://authjs.dev) — GitHub & Google, database sessions |
| Database | PostgreSQL · [Prisma 7](https://www.prisma.io) (`@prisma/adapter-pg`) |
| Payments | [Razorpay](https://razorpay.com) (subscriptions) · [Lemon Squeezy](https://lemonsqueezy.com) (one‑time) |
| Rate limiting | [Upstash Redis](https://upstash.com) with in‑memory fallback |
| Storage | [Vercel Blob](https://vercel.com/storage/blob) |
| Monitoring | [Sentry](https://sentry.io) |
| Testing | [Vitest](https://vitest.dev) |
| Hosting | [Vercel](https://vercel.com) |

## Getting started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (local or hosted — e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com))

### Setup

```bash
# 1. Clone and install
git clone https://github.com/singhharsh1708/scrollcraft.git
cd scrollcraft
npm install

# 2. Configure environment
cp .env.example .env
# → fill in DATABASE_URL, AUTH_SECRET, and any providers you want

# 3. Apply the database schema
npx prisma migrate deploy
npm run seed          # optional — seeds promo codes

# 4. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

See [`.env.example`](.env.example) for the full list. The essentials:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ (prod) | Session encryption secret (`NEXTAUTH_SECRET` is accepted as a v4 alias) |
| `AUTH_URL` | ✅ (prod) | Canonical app URL (`NEXTAUTH_URL` is accepted as a v4 alias) |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | – | GitHub OAuth |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | – | Google OAuth |
| `RAZORPAY_*` | – | Subscription payments |
| `LEMONSQUEEZY_*` | – | One‑time export purchases |
| `UPSTASH_REDIS_REST_*` | – | Distributed rate limiting |
| `BLOB_READ_WRITE_TOKEN` | – | Asset storage |
| `NEXT_PUBLIC_SENTRY_DSN` | – | Error monitoring |

## Available scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Generate Prisma client + production build |
| `npm start` | Run the production build |
| `npm run lint` | Lint with ESLint |
| `npm test` | Run the Vitest suite |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Tests with coverage report |
| `npm run deploy` | Apply pending Prisma migrations (`prisma migrate deploy`) |
| `npm run seed` | Seed the database (promo codes) |

## Project structure

```
src/
├── app/
│   ├── api/              # Route handlers (sites, payments, webhooks, export, …)
│   ├── templates/        # Template gallery + preview (/templates, /templates/[slug])
│   ├── s/                # Public published pages (/s/[slug])
│   ├── editor/           # The visual scroll-site editor
│   ├── create/           # Style + upload → editor flow
│   ├── dashboard/        # User dashboard: publish, edit, delete
│   └── pricing/          # Plans
├── components/           # UI + scroll engine (ScrollEngine, ScrollSection)
├── lib/                  # db, auth env, rate limiting, logger, payments clients
├── generated/prisma/     # Generated Prisma client
└── proxy.ts              # Edge route guard (Next 16 renamed middleware → proxy)
prisma/
├── schema.prisma         # Data model
├── migrations/           # SQL migrations
└── seed.ts               # Seed script
```

## Deploying

The app deploys to Vercel. Migrations run **separately** from the Vercel build, which has no
database access:

- A GitHub Action (`.github/workflows/migrate.yml`) runs `prisma migrate deploy` on every push
  to `main` that touches `prisma/migrations/`. It needs a `DATABASE_URL` repository secret
  pointing at the production database; without it the job no-ops rather than failing.
- Or run it by hand against production: `DATABASE_URL=... npm run deploy`.

Apply new migrations before the code that depends on them serves traffic, or routes reading a
new column will error.

## Plans and payments

Every template is free on every plan, including the free one. Paid plans raise how many
websites you keep **saved and published** (1 / 2 / 4 / 7 / 30), remove the "Made with
ScrollCraft" badge from published pages, and add priority support. The publish allowance is
enforced per plan in `POST /api/sites/[id]/publish`.

- **Subscriptions (Razorpay, INR):** webhooks verify HMAC signatures and update the user's
  plan idempotently.
- **One‑time purchases (Lemon Squeezy, global):** the checkout carries `site_id`/`user_id` as
  custom data; the webhook records a `PAID` `ExportPurchase` idempotently, keyed on the LS
  order id.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow,
coding standards, and how to pick up an issue.

## Sponsor

ScrollCraft is free and open source, and the hosted version costs real money to run
(frame rendering, blob storage, a database). If it saved you a studio invoice, you can
[sponsor the project on GitHub](https://github.com/sponsors/singhharsh1708), one-off or
monthly. Sponsoring funds the open source work — it is not a purchase and unlocks
nothing, which is deliberate.

Not in a position to pay? Starring the repo, filing a good bug report, or shipping a PR
helps just as much.

## License

[MIT](LICENSE) © ScrollCraft
