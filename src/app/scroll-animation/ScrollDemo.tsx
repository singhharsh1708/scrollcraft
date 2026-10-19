"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { drawFrame2D, type FrameOptions } from "@/lib/generate2DFrames";

const FRAMES = 120;
const OPTS: FrameOptions = { style: "wave", color1: "#0ea5e9", color2: "#6366f1", color3: "#0f172a", frameCount: FRAMES };
const SPAN = 0.6;

// Scroll position picks one of 120 frames, as an image sequence would; frames are drawn, not downloaded.
export default function ScrollDemo() {
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const [frame, setFrame] = useState(0);
  const [reduced, setReduced] = useState(false);

  const draw = useCallback((index: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFrame2D(ctx, w, h, (index / (FRAMES - 1)) * SPAN, OPTS);
  }, []);

  const show = useCallback(
    (index: number) => {
      if (index === frameRef.current) return;
      frameRef.current = index;
      setFrame(index);
      draw(index);
    },
    [draw]
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => draw(frameRef.current));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  useEffect(() => {
    if (reduced) return;
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const travel = Math.max(1, track.offsetHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, -track.getBoundingClientRect().top / travel));
      show(Math.round(p * (FRAMES - 1)));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(raf);
    };
  }, [reduced, show]);

  return (
    <div ref={trackRef} className={reduced ? "" : "h-[220svh]"}>
      <div className={`${reduced ? "" : "sticky top-[calc(var(--nav-h)+24px)]"} overflow-hidden rounded-lg border border-border bg-card`}>
        <canvas ref={canvasRef} aria-hidden="true" className="block h-[52svh] min-h-[280px] w-full bg-[#0f172a]" />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border px-5 py-4">
          <p className="lc-mono text-sm text-primary-ink">
            Frame {String(frame + 1).padStart(3, "0")} of {FRAMES}
          </p>
          {reduced ? (
            <label className="flex flex-1 items-center gap-3 text-sm text-muted-foreground">
              <span>Scrub</span>
              <input
                type="range"
                min={0}
                max={FRAMES - 1}
                value={frame}
                onChange={(e) => show(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </label>
          ) : (
            <div className="h-1 min-w-[120px] flex-1 overflow-hidden rounded-full bg-border" aria-hidden="true">
              <div className="h-full bg-primary-ink" style={{ width: `${(frame / (FRAMES - 1)) * 100}%` }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
