"use client";
import { useEffect, useRef, useCallback, useState } from "react";

interface ScrollEngineProps {
  frames: string[];
  mobileFrames?: string[];
  totalScrollHeight?: number;
  className?: string;
  onFrameChange?: (index: number) => void;
  scrollContainer?: React.RefObject<HTMLElement | null>;
  altText?: string;
  /** Use "absolute" in simulator containers (editor preview); "fixed" (default) for full-screen production use */
  position?: "fixed" | "absolute";
  /** Force the mobile frame set regardless of the real viewport — used by the editor's device simulator. */
  forceMobile?: boolean;
}

export default function ScrollEngine({ frames, mobileFrames, totalScrollHeight = 5000, className = "", onFrameChange, scrollContainer, altText = "Animated scroll background", position = "fixed", forceMobile }: ScrollEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef(0);
  const rafRef = useRef<number>(0);
  const loadedRef = useRef(false);
  // drawFrame needs CSS pixels: the context is already scaled by DPR, so measuring the
  // backing store instead drew every frame devicePixelRatio times too large on retina.
  const cssSizeRef = useRef({ w: 0, h: 0 });
  // Guards against a stale frame set winning. Late-arriving loads from a previous set
  // used to reassign imagesRef to their own array — in the editor the slow demo-frame
  // HTTP requests reliably landed after the real data: URLs and clobbered them.
  const loadTokenRef = useRef(0);
  const [matchesMobile, setMatchesMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );

  const isMobile = forceMobile ?? matchesMobile;
  const activeFrames = isMobile && mobileFrames?.length ? mobileFrames : frames;

  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    const img = imagesRef.current[index];
    if (!canvas || !img || !img.complete) return;
    if (!img.naturalWidth || !img.naturalHeight) return; // image failed to load (404/timeout)
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w: cw, h: ch } = cssSizeRef.current;
    if (!cw || !ch) return;
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }, []);

  const preloadImages = useCallback((frameSrcs: string[]) => {
    const images: HTMLImageElement[] = new Array(frameSrcs.length);
    const token = ++loadTokenRef.current;
    const isCurrent = () => loadTokenRef.current === token;
    const KEYFRAME_STEP = 5;

    // When a non-keyframe loads (or errors), redraw if it's the active frame.
    const loadImage = (index: number) => {
      const img = new Image();
      img.src = frameSrcs[index];
      img.onload = () => {
        if (!isCurrent()) return;
        images[index] = img;
        imagesRef.current = images;
        if (index === 0 || index === currentFrameRef.current) drawFrame(index);
      };
      // onerror: leave slot undefined so drawFrame skips it gracefully.
      return img;
    };

    const keyframeIndices = frameSrcs.map((_, i) => i).filter(i => i % KEYFRAME_STEP === 0);
    let settled = 0; // counts both successes and failures so the chain never hangs

    keyframeIndices.forEach(i => {
      const img = new Image();
      img.src = frameSrcs[i];
      const advance = () => {
        if (!isCurrent()) return;
        settled++;
        if (settled === keyframeIndices.length) {
          frameSrcs.forEach((_, j) => {
            if (j % KEYFRAME_STEP !== 0) loadImage(j);
          });
          loadedRef.current = true;
        }
      };
      img.onload = () => {
        if (!isCurrent()) return;
        images[i] = img;
        imagesRef.current = images;
        // Draw if this is frame 0 or the user has scrolled to this frame already.
        if (i === 0 || i === currentFrameRef.current) drawFrame(i);
        advance();
      };
      img.onerror = advance; // count failure so we don't hang
    });

    imagesRef.current = images;
  }, [drawFrame]);

  // Detect mobile viewport
  useEffect(() => {
    if (!mobileFrames?.length || forceMobile !== undefined) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent) => setMatchesMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mobileFrames, forceMobile]);

  useEffect(() => {
    loadedRef.current = false;
    currentFrameRef.current = 0;
    preloadImages(activeFrames);
  }, [activeFrames, preloadImages]);

  useEffect(() => {
    const el = scrollContainer?.current ?? window;
    const handleScroll = () => {
      const scrollTop = scrollContainer?.current
        ? scrollContainer.current.scrollTop
        : window.scrollY;
      const viewHeight = scrollContainer?.current
        ? scrollContainer.current.clientHeight
        : window.innerHeight;
      const maxScroll = totalScrollHeight - viewHeight;
      const progress = Math.min(Math.max(scrollTop / maxScroll, 0), 1);
      const frameIndex = Math.floor(progress * (activeFrames.length - 1));

      if (frameIndex !== currentFrameRef.current) {
        currentFrameRef.current = frameIndex;
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => drawFrame(frameIndex));
        onFrameChange?.(frameIndex);
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [activeFrames.length, totalScrollHeight, drawFrame, onFrameChange, scrollContainer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // In simulator mode the canvas is pinned inside a scroll container, so its own
      // offset size is not the visible area — measure the container instead.
      const host = position === "absolute" ? scrollContainer?.current : null;
      const cssW = host?.clientWidth || canvas.offsetWidth || window.innerWidth;
      const cssH = host?.clientHeight || canvas.offsetHeight || window.innerHeight;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      cssSizeRef.current = { w: cssW, h: cssH };
      const ctx = canvas.getContext("2d");
      // Assigning width/height resets the transform, so this scale does not compound.
      if (ctx) ctx.scale(dpr, dpr);
      drawFrame(currentFrameRef.current);
    };

    resize();
    window.addEventListener("resize", resize);

    // The simulator container resizes when the device mode changes without the window
    // ever resizing, which would otherwise leave the canvas at the old dimensions.
    const host = position === "absolute" ? scrollContainer?.current : null;
    const observer = host ? new ResizeObserver(resize) : null;
    if (host && observer) observer.observe(host);

    return () => {
      window.removeEventListener("resize", resize);
      observer?.disconnect();
    };
  }, [drawFrame, position, scrollContainer]);

  // "fixed" pins to the viewport. In a scroll container that is wrong — and plain
  // "absolute" positioned the canvas at the top of the scrolled content, so the
  // background scrolled away and left the overlays over bare backdrop. A zero-height
  // sticky wrapper keeps it pinned to the container without consuming flow space.
  if (position === "absolute") {
    return (
      <div ref={containerRef} className={className} style={{ position: "sticky", top: 0, height: 0, zIndex: 0 }}>
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 object-cover"
          role="img"
          aria-label={altText}
        />
        <span className="sr-only">{altText}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full object-cover"
        style={{ zIndex: 0 }}
        role="img"
        aria-label={altText}
      />
      <span className="sr-only">{altText}</span>
    </div>
  );
}
