import { SHARE_BASE } from "@/lib/pageMeta";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";
import { siteUrl } from "@/lib/env";

// A light neo-grotesque for display and body, and its monospace for every piece of UI
// chrome: nav, buttons, labels, captions.
const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const viewport: Viewport = {
  themeColor: "#030710",
};


export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ScrollCraft — Describe your business, get a scroll site",
    template: "%s | ScrollCraft",
  },
  description: "Write a few sentences about what you do, add a photograph or two, and get a finished scroll site to edit and export as plain HTML. First site free, five more for $20.",
  keywords: ["ai website builder", "scroll website builder", "animated canvas", "scrollytelling", "no-code", "scroll animation"],
  authors: [{ name: "ScrollCraft" }],
  openGraph: {
    ...SHARE_BASE,
    title: "ScrollCraft — Describe your business, get a scroll site",
    description: "Describe your business and get a finished scroll site to edit and export as plain HTML. First site free.",
    // No images key: src/app/opengraph-image.tsx generates the real 1200x630 card and
    // Next wires it up automatically. The hardcoded /og-image.png overrode that with a
    // file that does not exist, so every share rendered with no preview.
  },
  twitter: {
    card: "summary_large_image",
    title: "ScrollCraft — Describe your business, get a scroll site",
    description: "Describe your business and get a finished scroll site to edit and export as plain HTML. First site free.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-full antialiased">
          {children}
        <Toaster richColors position="bottom-right" />
        {process.env.NEXT_PUBLIC_VERCEL_ENV ? <Analytics /> : null}
      </body>
    </html>
  );
}
