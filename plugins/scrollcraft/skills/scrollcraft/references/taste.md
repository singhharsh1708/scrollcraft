# Taste

Rules that separate a scroll site someone finishes from one they close. Most are measurable,
and `verify.mjs` enforces the ones that are.

## Enforced by the tools

These fail a build or a verify run, so they are not advice.

- **Copy must clear 4.5:1 against the frame behind it.** Measured per line, per scroll
  position, against the real composite. Light text over a bright frame is the single most
  common way one of these pages becomes unreadable.
- **The background must actually advance.** A scrub that holds one frame is a still image
  with extra steps.
- **Frames must be a gap-free sequence.** One missing file is a black canvas and no error.
- **Generated palettes stay dark.** Peak average luma is checked; a bright `--colors`
  override warns.
- **Every section cannot share one layout.** The build says so when they do.

## Not enforced, still true

**Pacing.** The whole track is `Σ scrollHeight + 1000`, mapped linearly onto the frames. A
section's share of the track is its share of the sequence, so pacing is arithmetic, not feel:

- Under ~400px a section flashes past unread.
- 1200–1600px is the comfortable range for a heading plus two lines.
- Over ~2500px the reader wonders whether the page is broken. Use it once, for the peak.
- Long stretches with no copy are correct. Silence is the cheapest way to look confident.

**Type.** One display face, one body face. Never three.

- `poster` scale wants very few words. A ten-word heading at `clamp(2.6rem, 8vw, 6.5rem)` is
  a wall.
- `displayCase: "upper"` costs legibility and buys authority. Worth it for one or two words,
  never for a sentence.
- Negative tracking suits large display type; positive tracking suits small uppercase labels.
  Applying either to the wrong one is the giveaway of a generated page.

**Colour.** The accent appears twice at most: an eyebrow and a call to action. A third use and
it stops being an accent.

- `accentColor` is used for both eyebrow text and CTA background, and those pull in opposite
  directions. A colour readable as text on a dark frame is usually too light behind white
  button text. Set them per section if they fight, and re-run `verify`.
- Body copy at 70–75% opacity of the ink colour reads as deliberate hierarchy. Pure white
  body under a pure white heading reads as unfinished.

**Motion.** Pick one reveal and repeat it, with at most one exception at the peak.

- `stagger` is for a section with three or more elements. On a lone heading it looks broken.
- `mask` is the loudest. Once per page.
- `none` is a real choice for a dense `dossier` page where motion would be noise.

**Copy.** The reader is scrolling, not studying.

- One idea per section. A heading and at most two lines.
- Write the heading to be legible at a glance from across a room. If it needs a second read,
  it is body copy.
- Never ship the scaffold's placeholder text. It says "Replace this copy" for a reason.

## The failure mode to avoid

A page where every section is centred, every reveal rises, every track is 1000px, and the
heading is nine words. It is what you get by not choosing, and it is recognisable instantly.
Choose a grammar, choose a style, choose a reveal, and say why you chose them.
