import type { Metadata } from "next";

// page.tsx is a client component and so cannot export metadata itself. Without this the
// route is in the sitemap but inherits the homepage title and description.
export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with ScrollCraft — questions, bug reports, feature requests, billing and partnership enquiries.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
