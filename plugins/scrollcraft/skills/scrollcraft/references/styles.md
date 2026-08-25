# Generated backgrounds

`frames-from-style.mjs` renders a frame sequence with ffmpeg's `gradients` source, so a site
needs no footage. Nothing is downloaded and no dependency is added: ffmpeg is already
required for the video path.

## The six styles

Peak average luma is measured across the first frames of each render. It matters because the
frames sit behind white copy: past roughly 90 the text stops being readable, and the script
warns when a `--colors` override crosses that line.

| Style | Look | Gradient type | Peak luma |
| --- | --- | --- | --- |
| `aurora` | cold blue-teal spiral, slow drift | spiral | 42 |
| `nebula` | deep violet and blue, soft-focus | circular | 30 |
| `tide` | dark teal linear sweep | linear | 27 |
| `ember` | warm rust glow on near-black | radial | 22 |
| `dusk` | plum and clay, square falloff | square | 36 |
| `monolith` | graphite and steel, near-monochrome | square | 25 |

All six sit far below the limit, so any of them carries white text safely.

## Cost

A generated frame is roughly 15KB at 1920px against roughly 150KB for a frame of real
video, because a smooth gradient compresses far better than photographic detail. A
180-frame desktop plus mobile pair lands near 1MB, where the same thing from video is
closer to 36MB. On payload alone, generated backgrounds are the better default.

## Overriding the palette

```bash
frames-from-style.mjs --style tide --colors "#01090d,#0a2f3a,#1d8b96,#02121a" --seed 42
```

Two to eight colours, the limit of the underlying filter. Keep the first and last dark: they
dominate the frame edges, and the vignette that follows only darkens the corners. `--seed`
changes where the gradient starts, `--speed` how far it travels per frame — lower is calmer
and almost always better for a scroll background.

## When to shoot instead

Generated backgrounds are abstract. They cannot show a product, a place or a face. If the
site is about a physical thing, use `frames-from-video.mjs` with real footage and accept the
payload; an abstract gradient behind a product launch reads as a placeholder.
