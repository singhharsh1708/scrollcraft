# Page grammars

A grammar is the shape of the whole page: which layouts appear in which order, how the
scroll track is divided, and where the one loud moment sits. It is the thing that stops two
sites built by the same tool from sharing a skeleton.

Pick one deliberately. Do not default to the first.

## The six

Each row is a section. `track` is `scrollHeight`, and the proportions matter more than the
absolute numbers.

### `reveal` — a slow open, one peak, a quiet close
For a product or a launch. The peak is section 4 and nothing else competes with it.

| kind | layout | reveal | track |
| --- | --- | --- | --- |
| statement | center | mask | 1400 |
| spacer | — | — | 700 |
| text | left | stagger | 1500 |
| statement | lower-third | scale | 1800 |
| text | right | fade | 1200 |
| text | center | rise | 1000 |

### `catalogue` — alternating sides, even pacing
For several things of equal weight: features, models, chapters. The alternation carries the
rhythm, so no section needs to shout.

| kind | layout | reveal | track |
| --- | --- | --- | --- |
| statement | center | fade | 1200 |
| text | left | rise | 1300 |
| text | right | rise | 1300 |
| text | left | rise | 1300 |
| text | right | rise | 1300 |
| text | center | scale | 1000 |

### `manifesto` — text pinned low, background doing the talking
For a studio, a position, a piece of writing. Copy sits in the lower third throughout so the
frame stays the subject.

| kind | layout | reveal | track |
| --- | --- | --- | --- |
| statement | lower-third | mask | 1600 |
| text | lower-third | stagger | 1500 |
| spacer | — | — | 900 |
| text | lower-third | stagger | 1500 |
| statement | center | scale | 1400 |

### `dossier` — dense, upper-third, evenly cut
For specifications, data, a technical story. `compact` type scale suits it.

| kind | layout | reveal | track |
| --- | --- | --- | --- |
| text | upper-third | fade | 900 |
| text | upper-third | fade | 900 |
| text | upper-third | fade | 900 |
| text | upper-third | fade | 900 |
| text | center | rise | 900 |

### `descent` — starts loud, gets quieter
For something ending: a farewell, a retrospective, a closing argument. Reverses the usual
build so the largest type is first.

| kind | layout | reveal | track |
| --- | --- | --- | --- |
| statement | center | scale | 2000 |
| text | center | fade | 1400 |
| text | left | fade | 1200 |
| spacer | — | — | 800 |
| text | lower-third | fade | 900 |

### `single` — one screen, one idea
For a teaser, a holding page, a link in a bio. Long track, nothing else.

| kind | layout | reveal | track |
| --- | --- | --- | --- |
| statement | center | mask | 2600 |
| text | center | fade | 1000 |

## Choosing

- More than six sections and a scroll site stops being read. Cut copy before adding sections.
- Two `statement` sections is the maximum. Three means none of them lands.
- A `spacer` is not filler. It is the pause before something, and it only works if what
  follows deserves one.
- The grammar sets shape; the style sets mood. Pick both from the subject, and say why.
