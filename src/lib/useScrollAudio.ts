"use client";
import { useEffect, useRef, useCallback } from "react";

interface ScrollAudioOptions {
  audioSrc: string | null;
  scrollEl: React.RefObject<HTMLElement | null> | null;
  muted?: boolean;
}

export function useScrollAudio({ audioSrc, scrollEl, muted = false }: ScrollAudioOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastScrollY = useRef(0);
  const lastScrollTime = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRaf = useRef<number>(0);

  const fadeVolume = useCallback((audio: HTMLAudioElement, target: number, duration = 400) => {
    const start = audio.volume;
    const startTime = performance.now();
    cancelAnimationFrame(fadeRaf.current);
    function tick(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      audio.volume = start + (target - start) * t;
      if (t < 1) fadeRaf.current = requestAnimationFrame(tick);
      else if (target === 0) audio.pause();
    }
    fadeRaf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!audioSrc) {
      audioRef.current?.pause();
      audioRef.current = null;
      return;
    }

    const audio = new Audio(audioSrc);
    audio.loop = true;
    audio.volume = 0;
    audio.muted = muted;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSrc]); // intentionally excludes `muted` — toggling mute is handled by the dedicated effect below

  // Keep muted in sync without recreating
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    if (!audioSrc) return;
    const el: EventTarget = scrollEl?.current ?? window;

    const onScroll = () => {
      const audio = audioRef.current;
      if (!audio) return;

      const now = performance.now();
      const scrollY = scrollEl?.current ? scrollEl.current.scrollTop : window.scrollY;
      const dt = now - lastScrollTime.current;
      const velocity = dt > 0 ? Math.abs(scrollY - lastScrollY.current) / dt : 0;

      lastScrollY.current = scrollY;
      lastScrollTime.current = now;

      // Map velocity (px/ms) to volume: 0.05 → quiet, 0.5 → full
      const targetVolume = Math.min(Math.max(velocity / 0.5, 0.08), 1);

      if (audio.paused) {
        audio.volume = targetVolume;
        audio.play().catch(() => {/* autoplay blocked — user must interact first */});
      } else {
        cancelAnimationFrame(fadeRaf.current);
        audio.volume = targetVolume;
      }

      // Idle fade-out after 2s without scrolling
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        if (audioRef.current) fadeVolume(audioRef.current, 0);
      }, 2000);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [audioSrc, scrollEl, fadeVolume]);
}
