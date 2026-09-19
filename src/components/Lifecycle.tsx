"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import BrandMark from "@/components/BrandMark";

export type LifecycleLink = { label: string; href: string; external?: boolean };

export type LifecycleStep = {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  /** Each bullet leads with one bright word and trails off in muted text. */
  bullets: Array<[string, string]>;
  links: LifecycleLink[];
  panel: ReactNode;
};

/**
 * The stages from template to live site, as one scroll-driven section.
 *
 * On a wide screen a ring on the left turns so the current stage sits at its rightmost
 * point. On a phone the same stages become a row of tabs that sticks under the nav. The
 * active stage is whichever one is crossing the middle of the viewport, read from an
 * IntersectionObserver rather than from scroll events.
 */

const RING = { r: 360, cx: -126, cy: 280, w: 300, h: 560, stepDeg: 24 };

function ringPoint(offset: number) {
  const a = (offset * RING.stepDeg * Math.PI) / 180;
  return {
    x: Math.round(RING.cx + RING.r * Math.cos(a)),
    y: Math.round(RING.cy + RING.r * Math.sin(a)),
  };
}

function StepLink({ link }: { link: LifecycleLink }) {
  const inner = (
    <>
      {link.label} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
    </>
  );
  return link.external ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className="lc-btn lc-btn-ghost lc-btn-sm">
      {inner}
    </a>
  ) : (
    <Link href={link.href} className="lc-btn lc-btn-ghost lc-btn-sm">
      {inner}
    </Link>
  );
}

export default function Lifecycle({ steps }: { steps: LifecycleStep[] }) {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLElement | null)[]>([]);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = stepRefs.current.filter((el): el is HTMLElement => el !== null);
    if (els.length === 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = Number((entry.target as HTMLElement).dataset.index);
          if (!Number.isNaN(i)) setActive(i);
        }
      },
      // A thin band across the middle of the viewport: a stage is current while it
      // crosses it, so exactly one is current at a time.
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [steps.length]);

  // Keep the current tab in view on a phone, without moving the page itself.
  useEffect(() => {
    const strip = tabsRef.current;
    const tab = strip?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (!strip || !tab) return;
    strip.scrollTo({ left: tab.offsetLeft - strip.clientWidth / 2 + tab.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  const jump = (i: number) => {
    stepRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="relative mt-20">
      <nav aria-label="Stages" className="sticky top-[var(--nav-h)] z-30 -mx-6 mb-10 bg-background/85 px-6 py-3 backdrop-blur-md lg:hidden">
        <div ref={tabsRef} className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              data-tab={i}
              onClick={() => jump(i)}
              aria-current={i === active ? "step" : undefined}
              className={`lc-mono h-10 shrink-0 rounded-full border px-5 text-sm transition-colors ${
                i === active
                  ? "border-primary-ink/60 bg-primary-ink/15 text-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="relative hidden lg:block">
          <div className="sticky top-[calc(50vh-280px)] h-[560px] w-[300px]" aria-hidden="true">
            <svg className="absolute inset-0 overflow-visible" width={RING.w} height={RING.h}>
              <circle cx={RING.cx} cy={RING.cy} r={RING.r} fill="none" stroke="var(--border)" strokeWidth="1" />
              <circle cx={RING.cx} cy={RING.cy} r={RING.r - 72} fill="none" stroke="var(--border)" strokeOpacity="0.55" strokeWidth="1" />
            </svg>
            <div
              className="absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary-ink/50 bg-card shadow-[0_0_40px_-6px_rgba(0,109,221,0.8)]"
              style={{ left: ringPoint(0).x, top: ringPoint(0).y }}
            >
              <BrandMark className="h-5 w-5 text-primary-ink" />
            </div>
            {steps.map((s, i) => {
              const offset = i - active;
              if (offset === 0) return null;
              const p = ringPoint(offset);
              const distance = Math.abs(offset);
              return (
                <span
                  key={s.id}
                  className="lc-mono absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground transition-all duration-500"
                  style={{ left: p.x, top: p.y, opacity: distance === 1 ? 1 : distance === 2 ? 0.45 : 0 }}
                >
                  {s.label}
                </span>
              );
            })}
          </div>
        </div>

        <div>
          {steps.map((s, i) => (
            <section
              key={s.id}
              id={`stage-${s.id}`}
              data-index={i}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              aria-labelledby={`stage-${s.id}-title`}
              className="grid items-center gap-10 py-12 lg:min-h-[78vh] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14 lg:py-0"
            >
              <div className="order-2 lg:order-1">
                <h3 id={`stage-${s.id}-title`} className="lc-display text-4xl text-foreground sm:text-5xl">
                  {s.title}
                </h3>
                <p className="lc-display mt-5 max-w-lg text-2xl leading-snug text-primary-ink sm:text-[1.7rem]">
                  {s.subtitle}
                </p>
                <ul className="mt-8 space-y-2.5">
                  {s.bullets.map(([lead, rest]) => (
                    <li key={lead} className="flex gap-3 text-[1.05rem] leading-relaxed">
                      <span className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary-ink" aria-hidden="true" />
                      <span>
                        <span className="text-foreground">{lead}</span>
                        <span className="text-muted-foreground">{rest}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                {s.links.length > 0 && (
                  <div className="mt-9 flex flex-wrap gap-2">
                    {s.links.map((link) => (
                      <StepLink key={link.label} link={link} />
                    ))}
                  </div>
                )}
              </div>
              <div className="order-1 lg:order-2">{s.panel}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
