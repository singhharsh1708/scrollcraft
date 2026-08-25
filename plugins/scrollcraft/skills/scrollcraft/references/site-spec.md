# `scrollcraft.json` reference

The authoritative definition of a section is `src/lib/siteSchema.ts` in this repository. The
hosted app validates every save against it and the exporter renders from it, so a spec the
skill produces is the same shape the product stores. This page documents that schema; if the
two ever disagree, the module is right.


The spec is the single source of truth for a build. Paths inside it resolve relative to the
spec file, not the working directory.

## Top level

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `name` | string | `"ScrollCraft Site"` | Page `<title>` and `og:title`. |
| `description` | string | none | Emits `<meta name="description">` and `og:description`. Omitted entirely when absent rather than left empty. |
| `lang` | string | `"en"` | `<html lang>`. |
| `canvasAlt` | string | falls back to `name` | `aria-label` on the canvas. The canvas is the whole visual, so screen readers get nothing without this. |
| `frames` | string | `"frames"` | Desktop frame directory. |
| `framesMobile` | string | none | Mobile frame directory. Omit and phones load desktop frames. |
| `audio` | string | none | Path to an audio file. Copied to `dist/audio.<ext>`. |
| `customCss` | string | none | Injected as a second `<style>` block, after the engine CSS, so it wins on ties. Filtered. |
| `sections` | array | required | At least one entry with `visible !== false`. |

## Section fields

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `layout` | string | `center` | One of `center`, `left`, `right`, `lower-third`, `upper-third`. Sets alignment, measure and padding together. An unknown value fails the build. |
| `heading` | string | none | Renders as `<h2>`, `clamp(2rem, 5vw, 4rem)`. |
| `body` | string | none | One paragraph, capped at 600px measure. |
| `eyebrow` | string | none | Small uppercase label above the heading. |
| `ctaLabel` | string | none | Renders a button-styled link. Needs `ctaHref` to go anywhere. |
| `ctaHref` | string | `"#"` | Only `http://`, `https://` and in-page `#anchors` survive; anything else becomes `#`. |
| `scrollHeight` | number | `1000` | Scroll track in px this section occupies. Drives pacing. |
| `align` | string | from `layout` | Flex `align-items` on the sticky wrapper. Overrides the layout. |
| `justify` | string | from `layout` | Flex `justify-content`. Overrides the layout. |
| `textAlign` | string | from `layout` | Text alignment inside the content block. Overrides the layout. |
| `accentColor` | string | `#ddd6fe` eyebrow / `#7c3aed` CTA | Used for both. Note the two roles pull in opposite directions: a colour readable as text on a dark frame is usually too light behind white CTA text. Run `verify.mjs` after overriding it. |
| `headingColor` | string | `#ffffff` | |
| `bodyColor` | string | `rgba(255,255,255,0.7)` | |
| `visible` | boolean | `true` | `false` excludes the section from both the output and the scroll-track total. |
| `image` | string | none | Path to an image, resolved relative to the spec. Copied to `dist/assets/img_NN.<ext>`. Allowed: png, jpg, jpeg, webp, avif, gif, svg. A missing file fails the build. |
| `imageAlt` | string | `""` | Alt text. Omitting it emits a build warning, because the image then carries nothing for a screen reader. |
| `imageWidth` | number | `480` | Max rendered width in px, capped at 1600. The image never exceeds its container. |

## How pacing works

```
totalScrollHeight = Σ scrollHeight (visible sections only) + 1000
```

The trailing `1000` plus a leading `100vh` spacer give the first frame a beat to land before
any copy appears. Frame index is `round(progress × (frameCount - 1))` where `progress` is
scroll position over `totalScrollHeight - innerHeight`, clamped to `[0, 1]`. So frames spread
evenly across the whole track, and a section's share of the track is its share of the
sequence.

Hiding a section changes the pacing of every section after it, because the total shrinks.
That is intended: drafts should not inflate the track.

## Escaping

All text fields are HTML-escaped. Colour and alignment fields are stripped of
`< > " ' \ ; { }` because they are interpolated into inline `style` attributes, where a value
like `#fff;background-image:url(https://tracker/x.png)` would otherwise append a declaration
and make every visitor call out to that host. Parentheses are preserved so `rgba(...)` works.

`ctaHref` is protocol-checked, not escaped, so `javascript:` cannot survive as a link target.
