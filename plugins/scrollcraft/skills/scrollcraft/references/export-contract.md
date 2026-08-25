# Bundle contract

Both this skill and the hosted ScrollCraft exporter (`src/app/api/export-site/route.ts`)
emit the same layout. Keeping them identical is what lets a site move between the two.

```
dist/
├── index.html          all CSS and JS inlined, no external requests
├── frames/
│   ├── frame_0000.jpg
│   └── frame_0001.jpg  …
├── frames-mobile/      optional, served to (max-width: 767px)
└── audio.mp3           optional, extension varies
```

## Invariants

Anything consuming or producing this bundle must hold to these:

1. **Frame naming.** `frame_%04d.jpg`, starting at `0000`, gap-free. The runtime computes a
   path from an index rather than listing a directory, so a missing file is an unrecoverable
   silent hole.
2. **Canvas id.** `#scroll-canvas`, `position: fixed`, full viewport, `z-index: 0`.
3. **Scroll container.** `#scroll-container` carries the full `totalScrollHeight` and holds a
   leading `100vh` spacer, then one `.scroll-section` per visible section.
4. **Section structure.** `.scroll-section` > `.section-sticky` (`position: sticky; top: 0`) >
   `.section-content`. The `.visible` class on `.section-content` is what reveals it.
5. **Track maths.** `totalScrollHeight = Σ scrollHeight + 1000`.
6. **Frame mapping.** `round(progress × (frameCount - 1))`, `progress` clamped to `[0, 1]`,
   denominator `totalScrollHeight - innerHeight` guarded against `<= 0`.

## Runtime behaviour worth knowing

- **Keyframe preload.** Every 5th frame loads first; once all of those have settled, success
  or failure, the gaps fill in. So the scrub is usable early instead of waiting on the whole
  sequence. Failure is counted, not ignored, which is why one dead frame cannot hang the
  chain.
- **Draw guards.** `drawFrame` returns early unless the image is `complete` and reports
  non-zero `naturalWidth`/`naturalHeight`. A half-decoded image would otherwise throw or
  paint a 0×0 region.
- **DPR.** Capped at 2 and recomputed inside `resize`, so dragging the window to a non-Retina
  display rebuilds the backing store at the right ratio instead of a stale one.
- **Cover scaling.** `max(cssW / naturalWidth, cssH / naturalHeight)`, centred. Frames fill
  the viewport without distorting aspect ratio.
- **Breakpoint switching.** Only the set actually being drawn is fetched. Crossing the
  breakpoint loads the other set on demand and recomputes from the current scroll position,
  so rotating a phone does not snap the background back to frame 0.
- **One rAF in flight.** Scroll handlers coalesce into a single `requestAnimationFrame`;
  a scroll burst cannot queue a backlog of draws.
