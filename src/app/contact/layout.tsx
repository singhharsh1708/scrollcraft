import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";

// page.tsx is a client component and so cannot export metadata itself. Without this the
// route is in the sitemap but inherits the homepage title and description.
export const metadata: Metadata = pageMeta({
  title: "Contact us, or get a scroll website built",
  description: "Questions, bug reports and feature requests, or ask for a custom scroll-animated website built for your business.",
  path: "/contact",
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
