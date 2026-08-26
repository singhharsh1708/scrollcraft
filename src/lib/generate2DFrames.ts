export type Style2D = "gradient" | "geometric" | "particles" | "wave";

export interface FrameOptions {
  style: Style2D;
  color1: string;
  color2: string;
  color3: string;
  frameCount: number;
  width?: number;
  height?: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function drawGradient(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, opts: FrameOptions) {
  const [r1, g1, b1] = hexToRgb(opts.color1);
  const [r2, g2, b2] = hexToRgb(opts.color2);
  const [r3, g3, b3] = hexToRgb(opts.color3);

  const t1 = Math.sin(p * Math.PI * 2) * 0.5 + 0.5;
  const cr = lerp(lerp(r1, r2, t1), r3, p);
  const cg = lerp(lerp(g1, g2, t1), g3, p);
  const cb = lerp(lerp(b1, b2, t1), b3, p);

  const grad = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, w * 0.8);
  grad.addColorStop(0, `rgb(${Math.round(cr)},${Math.round(cg)},${Math.round(cb)})`);
  grad.addColorStop(0.5, `rgb(${Math.round(cr * 0.4)},${Math.round(cg * 0.4)},${Math.round(cb * 0.4)})`);
  grad.addColorStop(1, `rgb(5,5,15)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Moving orbs
  for (let i = 0; i < 3; i++) {
    const angle = p * Math.PI * 2 + (i * Math.PI * 2) / 3;
    const ox = w * 0.5 + Math.cos(angle) * w * 0.25;
    const oy = h * 0.5 + Math.sin(angle * 0.7) * h * 0.2;
    const orbGrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, w * 0.2);
    orbGrad.addColorStop(0, `rgba(${Math.round(cr)},${Math.round(cg)},${Math.round(cb)},0.35)`);
    orbGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = orbGrad;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawGeometric(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, opts: FrameOptions) {
  ctx.fillStyle = "#030308";
  ctx.fillRect(0, 0, w, h);

  const [r1, g1, b1] = hexToRgb(opts.color1);
  const [r2, g2, b2] = hexToRgb(opts.color2);

  const shapes = 12;
  for (let i = 0; i < shapes; i++) {
    const fi = i / shapes;
    const angle = (fi + p * 0.4) * Math.PI * 2;
    const size = (0.4 + Math.sin(fi * Math.PI * 3 + p * Math.PI * 2) * 0.15) * Math.min(w, h) * 0.18;
    const x = w * 0.5 + Math.cos(angle) * w * 0.3;
    const y = h * 0.5 + Math.sin(angle) * h * 0.3;
    const alpha = 0.08 + 0.12 * Math.sin(fi * Math.PI * 4 + p * Math.PI * 6);

    const t = (Math.sin(fi * Math.PI * 2 + p * Math.PI * 4) + 1) / 2;
    const rc = Math.round(lerp(r1, r2, t));
    const gc = Math.round(lerp(g1, g2, t));
    const bc = Math.round(lerp(b1, b2, t));

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * 2 + p * Math.PI);
    ctx.strokeStyle = `rgba(${rc},${gc},${bc},${alpha + 0.15})`;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = `rgba(${rc},${gc},${bc},${alpha})`;

    const sides = 3 + (i % 4);
    ctx.beginPath();
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2 - Math.PI / 2;
      if (s === 0) ctx.moveTo(Math.cos(a) * size, Math.sin(a) * size);
      else ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Center glow
  const [r3, g3, b3] = hexToRgb(opts.color3);
  const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.3);
  glow.addColorStop(0, `rgba(${r3},${g3},${b3},0.15)`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

function drawParticles(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, opts: FrameOptions) {
  ctx.fillStyle = "#020208";
  ctx.fillRect(0, 0, w, h);

  const [r1, g1, b1] = hexToRgb(opts.color1);
  const [r2, g2, b2] = hexToRgb(opts.color2);

  const count = 80;
  // Deterministic seeded positions using index
  for (let i = 0; i < count; i++) {
    const seed = (i * 9301 + 49297) % 233280;
    const bx = (seed / 233280) * w;
    const by = ((seed * 7) % 233280 / 233280) * h;

    const speed = 0.2 + ((seed * 3) % 100) / 100 * 0.6;
    const x = (bx + p * w * speed * 0.5) % w;
    const y = by + Math.sin(p * Math.PI * 2 * speed + i) * h * 0.04;
    const size = 1 + ((seed * 5) % 100) / 100 * 2.5;
    const alpha = 0.3 + Math.sin(p * Math.PI * 4 + i * 0.3) * 0.2;

    const t = (Math.sin(i * 0.4 + p * Math.PI * 2) + 1) / 2;
    const rc = Math.round(lerp(r1, r2, t));
    const gc = Math.round(lerp(g1, g2, t));
    const bc = Math.round(lerp(b1, b2, t));

    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rc},${gc},${bc},${alpha})`;
    ctx.fill();
  }

  // Nebula overlay
  const [r3, g3, b3] = hexToRgb(opts.color3);
  const nebula = ctx.createRadialGradient(w * 0.4, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.6);
  nebula.addColorStop(0, `rgba(${r3},${g3},${b3},0.08)`);
  nebula.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, w, h);
}

function drawWave(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, opts: FrameOptions) {
  ctx.fillStyle = "#020510";
  ctx.fillRect(0, 0, w, h);

  const [r1, g1, b1] = hexToRgb(opts.color1);
  const [r2, g2, b2] = hexToRgb(opts.color2);
  const [r3, g3, b3] = hexToRgb(opts.color3);

  const waves = 5;
  for (let wi = 0; wi < waves; wi++) {
    const fi = wi / waves;
    const t = (Math.sin(fi * Math.PI + p * Math.PI * 2) + 1) / 2;
    const rc = Math.round(lerp(r1, r2, t));
    const gc = Math.round(lerp(g1, g2, t));
    const bc = Math.round(lerp(b1, b2, t));
    const alpha = 0.07 + fi * 0.06;
    const amplitude = h * (0.08 + fi * 0.04);
    const freq = 2 + wi;
    const yBase = h * (0.3 + fi * 0.12);
    const phase = p * Math.PI * 2 * (1 + fi * 0.5);

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) {
      const y = yBase + Math.sin((x / w) * Math.PI * 2 * freq + phase) * amplitude
                      + Math.sin((x / w) * Math.PI * freq * 3 + phase * 1.3) * amplitude * 0.3;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = `rgba(${rc},${gc},${bc},${alpha})`;
    ctx.fill();
  }

  // Top glow
  const topGlow = ctx.createLinearGradient(0, 0, 0, h * 0.5);
  topGlow.addColorStop(0, `rgba(${r3},${g3},${b3},0.12)`);
  topGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Draw a single frame of any 2D style directly to a canvas context.
 * Used by live preview components (rAF loop) so they can animate a style
 * without pre-generating and JPEG-encoding a full frame sequence.
 * @param p progress 0..1 through the animation loop
 */
export function drawFrame2D(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: number,
  opts: FrameOptions
) {
  ctx.clearRect(0, 0, w, h);
  switch (opts.style) {
    case "gradient":   drawGradient(ctx, w, h, p, opts);   break;
    case "geometric":  drawGeometric(ctx, w, h, p, opts);  break;
    case "particles":  drawParticles(ctx, w, h, p, opts);  break;
    case "wave":       drawWave(ctx, w, h, p, opts);        break;
  }
}

/**
 * The drawing core as plain JavaScript, for inlining into an exported site.
 *
 * The export has no bundler, so the runtime has to travel as source. Serialising the
 * real functions rather than keeping a hand-written copy means the exported background
 * and the in-app one cannot drift apart — there is still only one implementation.
 */
export function proceduralRuntimeSource(): string {
  return [hexToRgb, lerp, drawGradient, drawGeometric, drawParticles, drawWave, drawFrame2D]
    .map((fn) => fn.toString())
    .join("\n\n");
}

export async function generate2DFrames(opts: FrameOptions, onProgress?: (pct: number) => void): Promise<string[]> {
  const w = opts.width ?? 1280;
  const h = opts.height ?? 720;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const frames: string[] = [];

  // A single-frame sequence has no span to interpolate across; clamp so p stays 0 rather than NaN.
  const lastIndex = Math.max(opts.frameCount - 1, 1);

  for (let i = 0; i < opts.frameCount; i++) {
    const p = i / lastIndex;

    drawFrame2D(ctx, w, h, p, opts);

    frames.push(canvas.toDataURL("image/jpeg", 0.85));

    // Yield every 10 frames to keep the browser responsive
    if (i % 10 === 0) {
      onProgress?.(Math.round((i / opts.frameCount) * 100));
      await new Promise(r => setTimeout(r, 0));
    }
  }
  onProgress?.(100);
  return frames;
}
