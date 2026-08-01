<div align="center">

# ✦ ScrollCraft

**Build cinematic scroll websites with AI — no code, pure HTML.**

Describe a visual atmosphere, and ScrollCraft generates hundreds of scroll‑linked
canvas frames, then exports a production‑ready HTML/CSS/JS ZIP you can deploy anywhere.

[Live demo](https://scrollcraft-gilt.vercel.app) · [Report a bug](https://github.com/singhharsh1708/scrollcraft/issues) · [Request a feature](https://github.com/singhharsh1708/scrollcraft/issues)

</div>

---

## What is ScrollCraft?

Apple‑style scroll animations (where the page scrubs through a sequence of frames as you
scroll) are gorgeous — and historically expensive. You either hire a studio, learn WebGL,
or ship a heavy JavaScript framework that tanks your Lighthouse score.

ScrollCraft removes all of that. You:

1. **Describe a vibe** — *"neon rain cityscape"*, *"golden desert sunrise"*, *"brutalist grid"* — or upload your own video.
2. **Get frames** — the engine produces a sequence of canvas frames mapped to scroll position.
3. **Edit visually** — add sections, copy, CTAs, audio, custom CSS, and chat‑edit with AI.
4. **Export** — download a self‑contained ZIP (`index.html`, frames, audio). No runtime dependencies, deploys to any static host in under a minute.

## Features

- 🎨 **Generated scroll frames** — pick a style (gradient, geometric, particles, wave) and a palette; the frame sequence is rendered in-browser on canvas, no API key required.
- 🎬 **Scroll‑linked animation engine** — smooth canvas scrubbing, desktop + mobile frame sets.
- 🤖 **AI chat editor** — *"make it purple"*, *"center the text"* — edits applied live.
- 📦 **Pure HTML export** — zero dependencies, zero lock‑in, deploy anywhere.
- 🎞️ **Bring your own video** — upload an MP4 or paste a URL; frames are extracted automatically.
- 🔊 **Scroll‑synced audio** — attach a soundtrack that responds to scroll position.
- 💳 **Payments** — Razorpay subscriptions (INR) + Lemon Squeezy one‑time export purchases (global).
- 🔒 **Production‑grade** — rate limiting, structured logging, security headers, Sentry, Zod‑validated APIs.

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

> **Demo mode:** without an AI provider key, ScrollCraft runs in demo mode using placeholder
> frames so you can explore the editor without any external services.

## Environment variables

See [`.env.example`](.env.example) for the full list. The essentials:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ (prod) | Session encryption secret (`NEXTAUTH_SECRET` is accepted as a v4 alias) |
| `AUTH_URL` | ✅ (prod) | Canonical app URL (`NEXTAUTH_URL` is accepted as a v4 alias) |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | – | GitHub OAuth |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | – | Google OAuth |
| `LUMAAI_API_KEY` / `RUNWAYML_API_KEY` | – | Text-to-video generation. The `/api/generate-video` route is implemented but not yet wired to any UI — frame generation currently runs on canvas in the browser. |
| `ANTHROPIC_API_KEY` | – | AI chat editing |
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
│   ├── editor/           # The visual scroll-site editor
│   ├── create/           # Prompt → generation flow
│   ├── dashboard/        # User dashboard
│   ├── pricing/          # Plans + promo codes
│   └── launch/           # Product Hunt landing page
├── components/           # UI + scroll engine (ScrollEngine, ScrollSection)
├── lib/                  # db, auth env, rate limiting, logger, payments clients
├── generated/prisma/     # Generated Prisma client
└── proxy.ts              # Edge route guard (Next 16 renamed middleware → proxy)
prisma/
├── schema.prisma         # Data model
├── migrations/           # SQL migrations
└── seed.ts               # Seed script
```

## How payments work

- **Subscriptions (Razorpay, INR):** paid plans unlock unlimited exports and higher limits.
  Webhooks verify HMAC signatures and update the user's plan idempotently.
- **One‑time export purchases (Lemon Squeezy, global):** free users can buy a single site
  export. The checkout carries `site_id`/`user_id` as custom data; the webhook records a
  `PAID` `ExportPurchase` (idempotent, keyed on the LS order id), which the export endpoint
  checks before serving the ZIP.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow,
coding standards, and how to pick up an issue.

## License

[MIT](LICENSE) © ScrollCraft
