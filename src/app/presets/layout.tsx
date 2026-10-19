import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";

export const metadata: Metadata = pageMeta({
  title: "Scroll animation background presets",
  description: "Ready-made animated backgrounds for scroll websites: gradient, geometric, particles and wave, each with its own palette. Free to use and export.",
  path: "/presets",
});

export default function PresetsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
