import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";

// page.tsx is a client component and so cannot export metadata itself. Without this the
// route is in the sitemap but inherits the homepage title and description.
export const metadata: Metadata = pageMeta({
  title: "Contact",
  description: "Questions, bug reports, feature requests, and custom scroll sites built to order.",
  path: "/contact",
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
