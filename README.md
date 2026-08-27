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
4. **Export** — download a self‑contained ZIP and put it anywhere. It carries its own 404 page, favicon, social card, `robots.txt`, and config for Netlify, Vercel, GitHub Pages and Cloudflare, so deploying is dragging a folder.

## Features

- 🎨 **Generated scroll frames** — pick a style (gradient, geometric, particles, wave) and a palette; the frame sequence is rendered in-browser on canvas, no API key required.
- 🎬 **Scroll‑linked animation engine** — smooth canvas scrubbing, desktop + mobile frame sets.
- 🧩 **Template library** — 21 finished scroll sites across 11 categories, all free, each with its own Google Fonts pairing and palette.
- 📦 **Pure HTML export** — zero dependencies, zero lock‑in, deploy anywhere. The ZIP ships a 404 page, favicon, social card, `robots.txt` and host configs, and scores 100 across Lighthouse.
- 🎞️ **Bring your own video** — frames are extracted in your browser; the file never leaves your device.
- 🔊 **Scroll‑synced audio** — attach a soundtrack that responds to scroll position.
- 🔓 **No account, no database, no payment** — clone it and run it. Nothing to sign up for, nothing to configure, nothing to pay.

## Two ways to use ScrollCraft

**Hosted app** — pick a template, edit it visually, export a ZIP. No sign-in.
See [Getting started](#getting-started) to run it yourself.

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
| Rendering | HTML5 Canvas — no WebGL, no animation library |
| Rate limiting | [Upstash Redis](https://upstash.com), optional, with in-memory fallback |
| Monitoring | [Sentry](https://sentry.io), optional |
| Testing | [Vitest](https://vitest.dev) |

There is no database, no authentication and no payment provider. There is nothing
to sign up for and nothing to configure.

## Getting started

### Prerequisites

Node.js 20 or newer. That is the whole list.

```bash
git clone https://github.com/singhharsh1708/scrollcraft.git
cd scrollcraft
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No `.env`, no database, no keys.

## Environment variables

Every variable is optional — see [`.env.example`](.env.example).

| Variable | Purpose |
|----------|---------|
| `SITE_URL` | Public origin for `robots.txt`, the sitemap and canonical URLs |
| `UPSTASH_REDIS_REST_*` | Shared rate limiting across instances; falls back to in-memory |
| `NEXT_PUBLIC_SENTRY_DSN` | Error reporting; leave empty to disable |
| `SENTRY_*` | Source map upload for readable stack traces |

## Where your work lives

Nowhere but your own browser, and then in the ZIP you download.

Sites are held in IndexedDB on your device while you edit. Nothing is uploaded, no
account exists to attach it to, and closing the tab does not send anything anywhere.
The trade-off is deliberate and worth stating plainly: **clear your browser data and
unexported work is gone.** Export early.

## Available scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | Lint with ESLint |
| `npm test` | Run the Vitest suite |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Tests with coverage report |

## Project structure

```
src/
├── app/
│   ├── api/              # Route handlers (sites, payments, webhooks, export, …)
│   ├── templates/        # Template gallery + preview (/templates, /templates/[slug])
│   ├── editor/           # The visual scroll-site editor
│   └── create/           # Style + upload → editor flow
├── components/           # UI + scroll engine (ScrollEngine, ScrollSection)
├── lib/                  # templates, canvas frame generation, export assets, rate limiting
└── proxy.ts              # Edge headers (Next 16 renamed middleware → proxy)
```

## Deploying

There is no database and no migration step, so a deploy is a build.

```sh
npx vercel deploy --prod
```

It also runs anywhere that runs Next.js, and the sites it produces are static files
that run anywhere at all.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow,
coding standards, and how to pick up an issue.

## Sponsor

ScrollCraft is free and open source, and the hosted version still costs something to
run. If it saved you a studio invoice, you can
[sponsor the project on GitHub](https://github.com/sponsors/singhharsh1708), one-off or
monthly. Sponsoring funds the open source work — it is not a purchase and unlocks
nothing, which is deliberate.

Not in a position to pay? Starring the repo, filing a good bug report, or shipping a PR
helps just as much.

## License

[MIT](LICENSE) © ScrollCraft
