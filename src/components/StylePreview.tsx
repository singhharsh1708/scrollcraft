"use client";
import { useEffect, useRef } from "react";
import { drawFrame2D, type Style2D } from "@/lib/generate2DFrames";

interface StylePreviewProps {
  style: Style2D;
  colors: [string, string, string];
  /** Animation loop length in seconds (default 6s) */
  durationSec?: number;
  /** Pause the rAF loop to save CPU (e.g. when off-screen / not selected) */
  paused?: boolean;
  className?: string;
}

/**
 * Renders a live, looping animation of a 2D style directly to a canvas via
 * requestAnimationFrame — no JPEG encoding, no IndexedDB. Cheap enough to mount
 * several at once for the create-flow style gallery.
 */
export default function StylePreview({
  style,
  colors,
  durationSec = 6,
  paused = false,
  className = "",
}: StylePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Size the backing store to the element's rendered size, capped DPR for perf.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(rect.width, 1);
    const h = Math.max(rect.height, 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);

    const opts = {
      style,
      color1: colors[0],
      color2: colors[1],
      color3: colors[2],
      frameCount: 1, // unused by drawFrame2D
    };

    let rafId = 0;
    let start = 0;

    const tick = (ts: number) => {
      if (!start) start = ts;
      const elapsed = (ts - start) / 1000;
      const p = (elapsed % durationSec) / durationSec; // 0..1 loop
      drawFrame2D(ctx, w, h, p, opts);
      rafId = requestAnimationFrame(tick);
    };

    if (paused) {
      // Draw a single static frame so the card isn't blank while paused.
      drawFrame2D(ctx, w, h, 0, opts);
    } else {
      rafId = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(rafId);
  }, [style, colors, durationSec, paused]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
