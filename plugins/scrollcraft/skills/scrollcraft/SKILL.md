---
name: scrollcraft
description: >
  Build a cinematic scroll-driven website where scrolling scrubs a canvas frame sequence,
  Apple-product-page style, and emit a self-contained static bundle that deploys to any
  host with zero runtime dependencies. Works from a video, an existing image sequence, or
  no assets at all via generated cinematic backgrounds. Pins copy over the frames in sticky
  sections and verifies the result before shipping.
  Use for: "scroll animation site", "scroll-scrubbed video", "Apple-style scroll page",
  "scrollytelling landing page", "frame sequence website", "cinematic landing page".
---

# ScrollCraft

Scroll position drives a frame sequence painted on a fixed full-viewport canvas. Copy sits
in sticky sections above it, so text stays pinned while the background scrubs. Output is
`index.html` plus a `frames/` directory: no framework, no bundler, no runtime dependency.

This skill builds sites locally. The hosted builder at
https://github.com/singhharsh1708/scrollcraft additionally generates frame sequences from a
text prompt, offers a visual editor with AI chat editing, and hosts the result. Both emit
the same bundle layout, so a site built here can be opened in the hosted editor and vice
versa. Reach for the hosted product for a visual editor, AI chat editing and hosting; use
this skill to work on disk and in version control, with or without footage of your own.

## Fast path

If the user has no footage and just wants a site, one command produces a working one:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/scrollcraft/scripts/init.mjs" --name "Orrery" --style aurora
```

That writes `scrollcraft.json`, generates a procedural background plus its mobile set, and
builds `dist/`. Then replace the placeholder sections with real copy and rebuild. **Never
leave the starter copy in place** — it says "Replace this copy" and shipping it is worse
than shipping nothing.

## Workflow

Work in a dedicated directory. Every script lives in `${CLAUDE_PLUGIN_ROOT}/skills/scrollcraft/scripts/`.

### 1. Establish the source material

Three cases:

- **User has a video.** Short, slow, continuous camera motion works; hard cuts do not, because the scrub reads as a glitch. 4 to 12 seconds is the useful range.
- **User has a numbered image sequence.** Rename to `frame_0000.jpg` upward, gap-free, and skip to step 3.
- **User has nothing.** Generate a procedural background — see step 2b. Do not fabricate footage and never invent a video path; if a path they gave does not exist, stop and ask.

### 2a. Extract frames from their video

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/scrollcraft/scripts/frames-from-video.mjs" \
  --input hero.mp4 --out frames --fps 24 --width 1920 \
  --mobile-width 828 --mobile-out frames-mobile
```

Always build the mobile set. Without it phones download full-width desktop frames, which
is the single most common way one of these sites becomes unusable on cellular.

Budget: frame count is `fps × seconds`. At 24fps a 10-second clip is 240 frames; at roughly
150KB each that is ~36MB for the desktop set alone. Keep the pair under ~60MB total. Cut
`--fps` before cutting `--width`, the eye forgives a lower frame rate more readily than a
soft image.

### 2b. Or generate one, no footage required

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/scrollcraft/scripts/frames-from-style.mjs" --list
node "${CLAUDE_PLUGIN_ROOT}/skills/scrollcraft/scripts/frames-from-style.mjs" \
  --style nebula --count 180 --width 1920 --mobile-width 828 --mobile-out frames-mobile
```

Six styles, all measured dark enough to carry white text: `aurora`, `nebula`, `tide`,
`ember`, `dusk`, `monolith`. See `references/styles.md`. These are roughly 15KB a frame
rather than 150KB, so a 180-frame pair costs about 1MB total instead of 36MB — a
procedural background is the cheaper choice on payload as well as effort.

Pick the style from what the user is building, not at random, and say which you picked.
`--colors` overrides the palette; if your override is too bright the script warns, because
white copy over a light frame is unreadable no matter how good the palette looks alone.

### 3. Author the spec

Write `scrollcraft.json`. See `references/site-spec.md` for every field. Minimum:

```json
{
  "name": "Orrery",
  "description": "A precision instrument for people who measure things.",
  "sections": [
    { "eyebrow": "Introducing", "heading": "Orrery", "body": "Machined from one billet.", "scrollHeight": 1400 },
    { "heading": "Nothing wasted", "body": "Eleven parts. Each one load bearing.", "scrollHeight": 1200 },
    { "heading": "Yours", "ctaLabel": "Pre-order", "ctaHref": "https://example.com/buy", "scrollHeight": 900 }
  ]
}
```

Section count and `scrollHeight` set the pace. The whole scroll track is
`Σ scrollHeight + 1000`, and the frame sequence is mapped across it linearly, so a section
with double the height gets double the frames. Give the moments that matter more room.
Below ~400px of track a section flashes past unread.

### 4. Build

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/scrollcraft/scripts/build-site.mjs" \
  --spec scrollcraft.json --out dist
```

Emits `dist/index.html`, `dist/frames/`, and `dist/frames-mobile/` plus `dist/audio.<ext>`
when the spec names audio. All CSS and JS is inlined into the one HTML file.

### 5. Verify before claiming it works

Two checks. Run both. Neither is optional.

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/scrollcraft/scripts/doctor.mjs" --spec scrollcraft.json
node "${CLAUDE_PLUGIN_ROOT}/skills/scrollcraft/scripts/verify.mjs" --dir dist --shots shots
```

`doctor` reads the files: gapped frame sequence, empty spec, missing audio, non-positive
`scrollHeight`. It cannot tell you the page renders.

`verify` opens the built site in headless Chrome, scrolls it, and measures what the reader
actually sees at each position:

- the canvas is painting at all, instead of the black rectangle a 404 frame produces
- the background genuinely advances, instead of holding one frame the whole way down
- **every line of copy clears 4.5:1 contrast against the pixels behind it**, sampled from the
  real composite at that scroll offset, with an element's own background used when it has one
- nothing 404s, nothing throws, the page never scrolls sideways

It exits non-zero on any of those. `--shots <dir>` also writes a PNG per sampled position if
you want to look. It needs Chrome, Chromium or Edge on the machine and nothing installed.

This is the check that matters, because the characteristic failure of this kind of page is
silent: a missing frame set renders a black canvas, throws nothing, and logs nothing. A build
that exits 0 is not evidence the site works. `verify` exiting 0 is.

### 6. Deploy

`dist/` is a static directory. Any host serves it as-is. Do not add a build step.

## Craft notes

These are what separate a convincing scroll site from an obviously generated one.

- **Vary the layout.** Every section takes `layout`: `center`, `left`, `right`, `lower-third`,
  `upper-third`. Consecutive screens that share a shape are what makes a scroll site read as a
  template. The build says so when all of them match.
- **One idea per section.** A heading and at most two lines. The reader is scrolling, not studying.
- **Let the footage breathe.** Sections that fire every 600px feel frantic. Long quiet stretches with no copy are correct and confident.
- **Match copy to motion.** If the camera pushes in on section three, that is where the product name belongs.
- **Accent colour, once.** `accentColor` on the eyebrow and the CTA, nowhere else.
- **An image earns its place.** A section can carry one (`image`, `imageAlt`, `imageWidth`) — use it for a logo, product shot or diagram, not for decoration competing with the background.
- **Contrast against the frames, not against black.** Light text over a bright frame is unreadable no matter what the palette says. Check the actual frames the copy sits over.
- **Respect reduced motion.** The engine already disables the reveal transitions under `prefers-reduced-motion`. Do not add motion the setting cannot turn off.

## Constraints

- Frames must be `frame_NNNN.jpg`, zero-padded to 4, starting at `0000`, gap-free. The build refuses a gapped sequence rather than shipping a stutter.
- Audio extensions are limited to mp3, m4a, wav, ogg, webm, aac, flac. Anything else is rejected, because static hosts serve unknown types as `application/octet-stream` and the browser silently declines to decode them.
- Audio starts muted and only plays after a real user gesture. Autoplay with sound is blocked by every current browser, so do not present it as a feature that works unprompted.
- `customCss` in the spec is filtered for `<script`, `<style`, `javascript:`/`data:` URLs and `expression(`. Treat it as a styling hook, not an extension point.
- Section images must be `png`, `jpg`, `jpeg`, `webp`, `avif`, `gif` or `svg`. `imageWidth` is capped at 1600px. A missing image fails the build rather than shipping a broken tag.
- `ffmpeg` is required for both frame paths and nothing else is. The build, doctor and preview server are plain Node with no dependencies.
