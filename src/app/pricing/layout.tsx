import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing for ScrollCraft. Start free, upgrade when you need more.",
  openGraph: {
    title: "Pricing | ScrollCraft",
    description: "Simple, transparent pricing. Start free, no credit card required.",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
