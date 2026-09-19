import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";

export const metadata: Metadata = pageMeta({
  title: "About",
  description: "Who builds ScrollCraft, why it is free and open source, and why every site it makes is plain HTML you keep.",
  path: "/about",
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
