import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Presets",
  description: "Explore ready-made scroll site presets. Pick one and launch in minutes.",
  openGraph: {
    title: "Presets | ScrollCraft",
    description: "Ready-made animated scroll site presets for every industry.",
  },
};

export default function PresetsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
