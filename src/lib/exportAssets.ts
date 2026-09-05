/**
 * The extra files that turn an export from "an index.html" into a site someone can
 * actually put online.
 *
 * A ZIP with nothing but markup leaves the owner to source an icon, build a social
 * card, write a 404 and work out per-host config — which is most of the work, and the
 * part a non-technical owner is least able to do.
 */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

/**
 * First character of the site name, for the icon glyph. Falls back to a dot.
 *
 * By code point: `"🚀 Rocket"[0]` is half a surrogate pair, not a character.
 */
function initial(siteName: string): string {
  const ch = [...siteName.trim()][0];
  return ch ? ch.toUpperCase() : "•";
}

/**
 * An SVG favicon built from the site's own palette. SVG so it stays crisp at every
 * size and needs no build step; every current browser supports it.
 */
export function faviconSvg(accent: string, ground: string, siteName: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${esc(siteName)}">
  <rect width="64" height="64" rx="14" fill="${esc(ground)}"/>
  <rect x="4" y="4" width="56" height="56" rx="12" fill="none" stroke="${esc(accent)}" stroke-width="3" opacity="0.9"/>
  <text x="32" y="43" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif"
        font-size="30" font-weight="700" fill="${esc(accent)}">${esc(initial(siteName))}</text>
</svg>
`;
}

/**
 * A 404 that matches the site rather than the host's default. Self-contained: a static
 * host serves this file directly, so it cannot rely on the main page's stylesheet.
 */
export function notFoundHtml(siteName: string, ground: string, ink: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Page not found — ${esc(siteName)}</title>
  <meta name="robots" content="noindex" />
  <link rel="icon" href="favicon.svg" type="image/svg+xml" />
  <style>
    *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: ${esc(ground)}; color: ${esc(ink)}; text-align: center; padding: 2rem;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    h1 { font-size: clamp(2.5rem, 8vw, 4rem); letter-spacing: -0.03em; margin-bottom: 0.5rem; }
    p { opacity: 0.7; margin-bottom: 1.75rem; line-height: 1.6; }
    a {
      color: inherit; text-decoration: none; border: 1px solid currentColor;
      padding: 0.7rem 1.6rem; border-radius: 999px; display: inline-block;
      transition: opacity 0.2s;
    }
    a:hover, a:focus-visible { opacity: 0.75; }
    @media (prefers-reduced-motion: reduce) { a { transition: none; } }
  </style>
</head>
<body>
  <main>
    <h1>404</h1>
    <p>That page doesn&#x27;t exist.</p>
    <a href="/">Back to ${esc(siteName)}</a>
  </main>
</body>
</html>
`;
}

/** Deploy instructions for the hosts people actually use, written for a non-developer. */
export function exportReadme(siteName: string, procedural: boolean, madeWithUrl: string): string {
  return `# ${siteName}

Your site, exported from [ScrollCraft](${madeWithUrl}).
Plain HTML, CSS and JavaScript — no build step, no framework, no account needed. It is
yours outright.

## Put it online

Pick whichever is easiest. All of them are free for a site this size.

**Netlify (drag and drop, no account needed to try)**
1. Go to https://app.netlify.com/drop
2. Drag this whole folder onto the page.
That is the entire process. \`netlify.toml\` is already here and sets long cache headers
on the frames.

**Vercel**
\`\`\`sh
npx vercel deploy --prod
\`\`\`
Run it inside this folder. \`vercel.json\` is already configured.

**GitHub Pages**
1. Create a repository and push this folder to it.
2. Settings → Pages → Source: deploy from branch, root.
The \`.nojekyll\` file is included, without which GitHub silently drops files whose names
begin with an underscore.

**Cloudflare Pages**
Create a project, connect the repository, and leave the build command empty with the
output directory set to \`/\`.

**Any other host**
Upload the contents of this folder to the web root. There is nothing to compile.

## Look at it locally first

Open a terminal in this folder and run:
\`\`\`sh
npx serve .
\`\`\`
Then open the address it prints.

Do **not** open \`index.html\` by double-clicking it. Browsers block a page loaded over
\`file://\` from reading its own neighbouring files, so the background will not appear.

## What is in here

| File | What it is |
| --- | --- |
| \`index.html\` | Your whole site |
| \`404.html\` | Shown for an address that does not exist |
| \`favicon.svg\` | The icon in the browser tab |
| \`og-image.jpg\` | The preview image when the link is shared |
| \`apple-touch-icon.png\` | The icon when saved to a phone's home screen |
| \`robots.txt\` | Tells search engines they may index the site |
| \`lenis.min.js\` | Smooth scrolling. Remove it and scrolling still works |
${procedural
  ? "\nThe background is drawn in the browser from a small style recipe, so there is no\n`frames/` folder. The page itself is about 35 KB; the social preview image is the only\nfile larger than that."
  : "\n| `frames/` | The background images |\n\nKeep `frames/` beside `index.html`."}

## Making changes

Everything is editable in a text editor.

- **Words** — search \`index.html\` for the text you want to change.
- **Colours** — near the top of the \`<style>\` block, the \`--sc-\` custom properties.
- **Social preview** — replace \`og-image.jpg\` with your own 1200×630 image.
- **Icon** — replace \`favicon.svg\`.

### The one thing only you can do

Your call-to-action button needs a real destination. Templates ship it pointing at a
placeholder, because only you know whether it should open a signup page, a booking form
or your inbox. Search \`index.html\` for the button's text and set its \`href\`:

\`\`\`html
<a href="https://your-domain.com/signup" ...>Get started</a>
\`\`\`

\`mailto:you@your-domain.com\` and \`tel:+1234567890\` both work too. A button whose
\`href\` starts with \`#\` scrolls to a section of this page; \`#section-1\` is the first
section, \`#section-2\` the second, and so on.

### One thing worth doing

The social preview and canonical address are relative, which works on most platforms but
not all. Once you know your real address, search \`index.html\` for \`og-image.jpg\` and make
it absolute:

\`\`\`html
<meta property="og:image" content="https://your-domain.com/og-image.jpg" />
\`\`\`

## Accessibility

The exported page already ships with a skip link, visible keyboard focus, an accessible
name on the background canvas, a \`prefers-reduced-motion\` fallback that disables the
reveal animations, and a \`<noscript>\` fallback that shows all content when JavaScript is
unavailable. If you edit the markup, keep the heading order intact — one \`<h1>\`, then
\`<h2>\`s — and give any image you add real \`alt\` text.
`;
}

/**
 * Render the 1200x630 social card in the browser, where the frames already are.
 *
 * Without this the exported page declares `twitter:card: summary_large_image` and then
 * has no image to show, so every share renders as a bare link. Returns null rather than
 * throwing: a missing card must never fail an export.
 */
export async function renderSocialCard(
  siteName: string,
  description: string,
  backgroundSrc: string | undefined,
  ground: string,
  ink: string
): Promise<Blob | null> {
  try {
    const W = 1200;
    const H = 630;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, W, H);

    // Use the site's own first frame as the backdrop when one is available.
    if (backgroundSrc) {
      const img = await new Promise<HTMLImageElement | null>((resolve) => {
        const el = new Image();
        el.crossOrigin = "anonymous";
        el.onload = () => resolve(el);
        el.onerror = () => resolve(null);
        el.src = backgroundSrc;
      });
      if (img?.naturalWidth) {
        const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      }
    }

    // Darken so the type stays legible over any background.
    const veil = ctx.createLinearGradient(0, 0, 0, H);
    veil.addColorStop(0, "rgba(0,0,0,0.35)");
    veil.addColorStop(1, "rgba(0,0,0,0.75)");
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, W, H);

    const font = 'system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = ink;
    ctx.textBaseline = "alphabetic";

    // Wrap the title by measured width rather than character count, so a long word or a
    // wide script does not run off the card.
    const title = siteName || "My site";
    ctx.font = `700 76px ${font}`;
    const maxWidth = W - 160;
    const words = title.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
      if (lines.length === 2) break;
    }
    if (line && lines.length < 3) lines.push(line);

    let y = description ? 300 : 350;
    for (const l of lines.slice(0, 3)) {
      ctx.fillText(l, 80, y);
      y += 88;
    }

    if (description) {
      ctx.font = `400 32px ${font}`;
      ctx.globalAlpha = 0.75;
      const desc = description.length > 110 ? `${description.slice(0, 107)}…` : description;
      ctx.fillText(desc, 80, y + 8);
      ctx.globalAlpha = 1;
    }

    // JPEG, not PNG: this is a photographic gradient, which PNG cannot compress. The same
    // 1200x630 card measured 544 KB as PNG and 46 KB as JPEG at this quality - it was 94%
    // of a procedural export's ZIP.
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85);
    });
  } catch {
    return null;
  }
}

/**
 * A square home-screen icon in the favicon's own design.
 *
 * iOS ignores SVG for apple-touch-icon and wants a 180x180 PNG; the export pointed the
 * tag at the 1200x630 social card, which iOS squashes into its square. Drawn here, in the
 * browser, from the same accent, ground and initial the favicon uses.
 */
export async function renderTouchIcon(accent: string, ground: string, siteName: string): Promise<Blob | null> {
  try {
    const S = 180;
    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const r = S * 14 / 64;
    const rounded = (x: number, y: number, w: number, h: number, rad: number) => {
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + w, y, x + w, y + h, rad);
      ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad);
      ctx.arcTo(x, y, x + w, y, rad);
      ctx.closePath();
    };

    ctx.fillStyle = ground;
    rounded(0, 0, S, S, r);
    ctx.fill();

    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = S * 3 / 64;
    rounded(S * 4 / 64, S * 4 / 64, S * 56 / 64, S * 56 / 64, S * 12 / 64);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = accent;
    ctx.font = `700 ${Math.round(S * 30 / 64)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(initial(siteName), S / 2, S * 43 / 64);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png");
    });
  } catch {
    return null;
  }
}
