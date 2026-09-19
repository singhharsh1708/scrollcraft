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
    default: "ScrollCraft — Cinematic Scroll Sites",
    template: "%s | ScrollCraft",
  },
  description: "Build immersive 2D scroll websites with animated canvas backgrounds. Pick a style, customise sections, export as pure HTML. No code needed.",
  keywords: ["scroll website builder", "animated canvas", "scrollytelling", "no-code", "scroll animation"],
  authors: [{ name: "ScrollCraft" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "ScrollCraft",
    title: "ScrollCraft — Cinematic Scroll Sites",
    description: "Build immersive 2D scroll websites with animated canvas backgrounds. No code needed.",
    // No images key: src/app/opengraph-image.tsx generates the real 1200x630 card and
    // Next wires it up automatically. The hardcoded /og-image.png overrode that with a
    // file that does not exist, so every share rendered with no preview.
  },
  twitter: {
    card: "summary_large_image",
    title: "ScrollCraft — Cinematic Scroll Sites",
    description: "Build immersive 2D scroll websites with animated canvas backgrounds. No code needed.",
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
