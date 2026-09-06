<div align="center">

# ScrollCraft

**Cinematic scroll websites, exported as plain HTML.**

Pick a template, change the words, download a ZIP, put it anywhere. The editor, every
template and the export are free and open source.

[Live demo](https://scrollcraft-gilt.vercel.app) · [Report a bug](https://github.com/singhharsh1708/scrollcraft/issues) · [Request a feature](https://github.com/singhharsh1708/scrollcraft/issues)

</div>

---

## What it does

A scroll-scrubbed site plays through a sequence of frames as the reader scrolls, so the
background moves with them instead of sitting still behind the text. ScrollCraft builds
those sites without WebGL, an animation library, or a render farm.

1. **Start from a template.** Twenty-one finished sites, each with its own palette,
   typography, pacing and copy. Or upload a video and use your own footage.
2. **Get frames.** The engine draws the frame sequence on a canvas in your browser and
   maps it to scroll position.
3. **Edit it.** Sections, copy, buttons, colours, audio, custom CSS.
4. **Export it.** A self-contained ZIP with a 404 page, favicon, social card,
   `robots.txt` and host config for Netlify, Vercel, GitHub Pages and Cloudflare.
   Deploying is dragging a folder.

Everything runs in the browser. There is no account, no database and nothing to buy. The
one exception is the copy assistant below, which is off unless you configure a key.

## Features

- **Generated backgrounds.** Choose a style (gradient, geometric, particles, wave) and a
  palette. Frames are drawn on canvas locally, with no API key and nothing to install.
- **Scroll engine.** Smooth canvas scrubbing with separate desktop and portrait frame sets,
  so a phone gets a background shaped for it rather than a letterboxed one.
- **Template library** — 21 finished scroll sites across 16 categories, each with its own
  Google Fonts pairing and palette.
- **Plain HTML export.** No dependencies and no lock-in. The exported page scores 100 on
  Lighthouse for performance, accessibility, best practices and SEO.
- **Your own video.** Frames are extracted in your browser. The file never leaves your
  device.
- **Scroll-linked audio.** Attach a track that fades in as the reader scrolls and out when
  they stop.
- **Copy rewriting, if you configure it.** Describe the change you want and the editor
  rewrites the section copy from it, in one undo step. It touches the words only, never
  the layout, colours, images or button links. It needs an API key, and without one the
  button is not shown at all. See [Environment variables](#environment-variables).

## Two ways to use it

**The hosted app** — pick a template, edit it, export a ZIP. See
[Getting started](#getting-started) to run it locally.

**A Claude Code skill** — build the same site on your machine, in version control, from
generated backgrounds or your own footage.

Both produce the same bundle layout (`index.html` plus `frames/frame_0000.jpg` upward), so
a site built by the skill opens in the hosted editor and an exported ZIP can be rebuilt by
the skill.

### Installing the skill

This repository is also a Claude Code plugin marketplace. From inside Claude Code:

```
/plugin marketplace add singhharsh1708/scrollcraft
/plugin install scrollcraft@scrollcraft
```

Then describe what you want, such as "build me a scroll site from hero.mp4". Run `/plugin`
and look for `scrollcraft` to confirm it registered. To update later:

```
/plugin marketplace update scrollcraft
```

### Using the skill

`ffmpeg` is the only external requirement (`brew install ffmpeg` or `apt install ffmpeg`).
The scripts are plain Node with no dependencies.

Ask Claude for a scroll site, or drive it yourself. The quickest path needs no footage and
scaffolds the spec, background and a working site in one command:

```bash
node plugins/scrollcraft/skills/scrollcraft/scripts/init.mjs --name "Orrery" --style aurora
```

Or step by step:

```bash
# 1a. your own video -> frame sequence, desktop and portrait
node plugins/scrollcraft/skills/scrollcraft/scripts/frames-from-video.mjs --input hero.mp4 --out frames \
  --fps 24 --width 1920 --mobile-width 828 --mobile-out frames-mobile

# 1b. or generate one: six styles, about 1 MB instead of about 36 MB
node plugins/scrollcraft/skills/scrollcraft/scripts/frames-from-style.mjs --list
node plugins/scrollcraft/skills/scrollcraft/scripts/frames-from-style.mjs --style nebula --count 180 \
  --width 1920 --mobile-width 828 --mobile-out frames-mobile

# 2. write scrollcraft.json describing your sections, then build
node plugins/scrollcraft/skills/scrollcraft/scripts/build-site.mjs --spec scrollcraft.json --out dist

# 3. check the files, then check what actually renders
node plugins/scrollcraft/skills/scrollcraft/scripts/doctor.mjs --spec scrollcraft.json
node plugins/scrollcraft/skills/scrollcraft/scripts/verify.mjs --dir dist --shots shots
node plugins/scrollcraft/skills/scrollcraft/scripts/serve.mjs --dir dist --port 4321
```

`verify.mjs` drives headless Chrome over the DevTools Protocol, scrolls the built page and
measures what a reader would actually see: that the canvas paints, that it advances, and
that every line of copy clears 4.5:1 contrast against the pixels behind it. A missing frame
set renders a black canvas without throwing or logging anything, so checking the files is
not enough on its own.

The plugin adds two slash commands: `/scrollcraft-new` to start a site and
`/scrollcraft-build` to rebuild, check and preview one.

`dist/` is a static directory with no runtime dependencies and no external requests.

Skill source is in [plugins/scrollcraft/](plugins/scrollcraft/). The bundle invariants both
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

## Getting started

Node.js 22 or newer. `verify.mjs` drives Chrome over the global `WebSocket`, which Node
only exposes unflagged from 22.

```bash
git clone https://github.com/singhharsh1708/scrollcraft.git
cd scrollcraft
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No `.env` file and no keys needed.

## Environment variables

Every variable is optional. See [`.env.example`](.env.example).

| Variable | Purpose |
|----------|---------|
| `SITE_URL` | Public origin for `robots.txt`, the sitemap and canonical URLs |
| `UPSTASH_REDIS_REST_*` | Shared rate limiting across instances; falls back to in-memory |
| `NEXT_PUBLIC_SENTRY_DSN` | Error reporting; leave empty to disable |
| `SENTRY_*` | Source map upload for readable stack traces |
| `SARVAM_API_KEY` | Turns on the editor's copy assistant. Absent, the button is not shown |
| `SARVAM_MODEL` | `sarvam-105b` (default) or `sarvam-105b-conversations` |
| `SARVAM_BASE_URL` | Any endpoint speaking the OpenAI chat-completions shape. Defaults to Sarvam |

## Where your work lives

In your own browser, and then in the ZIP you download.

Sites are held in IndexedDB on your device while you edit. Nothing is uploaded and no
account exists to attach it to. **Clear your browser data and unexported work is gone**, so
export early. The editor autosaves as you type and warns you before you close a tab with
unsaved changes.

## Scripts

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
│   ├── api/              # Route handlers (export-site, edit-site, demo-frame, health)
│   ├── templates/        # Template gallery and preview (/templates, /templates/[slug])
│   ├── editor/           # The visual scroll-site editor
│   └── create/           # Style and upload flow into the editor
├── components/           # UI and scroll engine (ScrollEngine, ScrollSection)
├── lib/                  # templates, canvas frame generation, export assets, rate limiting
└── proxy.ts              # Edge headers (Next 16 renamed middleware to proxy)
```

## Deploying

A deploy is a build, since there is no database and no migration step.

```sh
npx vercel deploy --prod
```

It runs anywhere that runs Next.js, and the sites it produces are static files that run
anywhere at all.

## Contributing

Contributions are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers the workflow, coding
standards and how to pick up an issue.

## Sponsor

The hosted version costs something to run. If ScrollCraft saved you a studio invoice, you
can [sponsor it on GitHub](https://github.com/sponsors/singhharsh1708), one-off or monthly.
Sponsoring funds the open source work and unlocks nothing.

Not in a position to pay? A star, a good bug report or a pull request helps just as much.

## License

[MIT](LICENSE) © ScrollCraft
