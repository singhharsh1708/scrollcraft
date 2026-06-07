"use client";
import { useEffect, useRef, useCallback } from "react";

interface ScrollEngineProps {
  frames: string[];
  totalScrollHeight?: number;
  className?: string;
  onFrameChange?: (index: number) => void;
  scrollContainer?: React.RefObject<HTMLElement | null>;
  altText?: string;
}

export default function ScrollEngine({ frames, totalScrollHeight = 5000, className = "", onFrameChange, scrollContainer, altText = "Animated scroll background" }: ScrollEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef(0);
  const rafRef = useRef<number>(0);
  const loadedRef = useRef(false);

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

  const preloadImages = useCallback(() => {
    const images: HTMLImageElement[] = new Array(frames.length);
    let keyframesLoaded = 0;
    const KEYFRAME_STEP = 5; // load every 5th frame first

    const loadImage = (index: number) => {
      const img = new Image();
      img.src = frames[index];
      img.onload = () => {
        images[index] = img;
        if (index === 0) drawFrame(0); // draw immediately on first frame
      };
      return img;
    };

    // Phase 1: load keyframes (every KEYFRAME_STEP)
    const keyframeIndices = frames
      .map((_, i) => i)
      .filter(i => i % KEYFRAME_STEP === 0);

    keyframeIndices.forEach(i => {
      const img = loadImage(i);
      img.onload = () => {
        images[i] = img;
        keyframesLoaded++;
        if (i === 0) drawFrame(0);
        // Phase 2: once all keyframes done, load the rest
        if (keyframesLoaded === keyframeIndices.length) {
          frames.forEach((_, j) => {
            if (j % KEYFRAME_STEP !== 0) loadImage(j);
          });
          loadedRef.current = true;
        }
      };
    });

    imagesRef.current = images;
  }, [frames, drawFrame]);

  useEffect(() => {
    preloadImages();
  }, [preloadImages]);

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
      const frameIndex = Math.floor(progress * (frames.length - 1));

      if (frameIndex !== currentFrameRef.current) {
        currentFrameRef.current = frameIndex;
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => drawFrame(frameIndex));
        onFrameChange?.(frameIndex);
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [frames.length, totalScrollHeight, drawFrame, onFrameChange, scrollContainer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawFrame(currentFrameRef.current);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [drawFrame]);

  return (
    <div ref={containerRef} className={className}>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full object-cover"
        style={{ zIndex: 0 }}
        role="img"
        aria-label={altText}
      />
      {/* Visually hidden fallback for screen readers and search crawlers */}
      <span className="sr-only">{altText}</span>
    </div>
  );
}
