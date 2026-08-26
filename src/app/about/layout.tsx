import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about ScrollCraft — who we are and why we built the easiest animated scroll website builder.",
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
