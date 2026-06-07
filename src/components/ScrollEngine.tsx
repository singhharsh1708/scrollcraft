"use client";
import { useEffect, useRef, useCallback } from "react";

interface ScrollEngineProps {
  frames: string[];
  totalScrollHeight?: number;
  className?: string;
  onFrameChange?: (index: number) => void;
  scrollContainer?: React.RefObject<HTMLElement | null>;
}

export default function ScrollEngine({ frames, totalScrollHeight = 5000, className = "", onFrameChange, scrollContainer }: ScrollEngineProps) {
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
    const images: HTMLImageElement[] = [];
    let loaded = 0;

    frames.forEach((src) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        loaded++;
        if (loaded === 1) drawFrame(0); // draw first frame immediately
        if (loaded === frames.length) loadedRef.current = true;
      };
      images.push(img);
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
      />
    </div>
  );
}
