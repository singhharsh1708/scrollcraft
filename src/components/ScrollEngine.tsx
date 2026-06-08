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
}

export default function ScrollEngine({ frames, mobileFrames, totalScrollHeight = 5000, className = "", onFrameChange, scrollContainer, altText = "Animated scroll background", position = "fixed" }: ScrollEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef(0);
  const rafRef = useRef<number>(0);
  const loadedRef = useRef(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );

  const activeFrames = isMobile && mobileFrames?.length ? mobileFrames : frames;

  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    const img = imagesRef.current[index];
    if (!canvas || !img || !img.complete) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }, []);

  const preloadImages = useCallback((frameSrcs: string[]) => {
    const images: HTMLImageElement[] = new Array(frameSrcs.length);
    let keyframesLoaded = 0;
    const KEYFRAME_STEP = 5;

    // When a non-keyframe loads, redraw immediately if it's the active frame.
    const loadImage = (index: number) => {
      const img = new Image();
      img.src = frameSrcs[index];
      img.onload = () => {
        images[index] = img;
        imagesRef.current = images;
        if (index === 0 || index === currentFrameRef.current) drawFrame(index);
      };
      return img;
    };

    const keyframeIndices = frameSrcs.map((_, i) => i).filter(i => i % KEYFRAME_STEP === 0);

    keyframeIndices.forEach(i => {
      const img = new Image();
      img.src = frameSrcs[i];
      img.onload = () => {
        images[i] = img;
        imagesRef.current = images;
        keyframesLoaded++;
        // Draw if this is frame 0 or the user has scrolled to this frame already.
        if (i === 0 || i === currentFrameRef.current) drawFrame(i);
        if (keyframesLoaded === keyframeIndices.length) {
          frameSrcs.forEach((_, j) => {
            if (j % KEYFRAME_STEP !== 0) loadImage(j);
          });
          loadedRef.current = true;
        }
      };
    });

    imagesRef.current = images;
  }, [drawFrame]);

  // Detect mobile viewport
  useEffect(() => {
    if (!mobileFrames?.length) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mobileFrames]);

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
      const cssW = canvas.offsetWidth || window.innerWidth;
      const cssH = canvas.offsetHeight || window.innerHeight;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
      drawFrame(currentFrameRef.current);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [drawFrame]);

  const canvasClass = position === "absolute"
    ? "absolute inset-0 w-full h-full object-cover"
    : "fixed inset-0 w-full h-full object-cover";

  return (
    <div ref={containerRef} className={className}>
      <canvas
        ref={canvasRef}
        className={canvasClass}
        style={{ zIndex: 0 }}
        role="img"
        aria-label={altText}
      />
      <span className="sr-only">{altText}</span>
    </div>
  );
}
