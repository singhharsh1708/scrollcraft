import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";

export const metadata: Metadata = pageMeta({
  title: "Presets",
  description: "Explore ready-made scroll site presets. Pick one and launch in minutes.",
  path: "/presets",
});

export default function PresetsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
