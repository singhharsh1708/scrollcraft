import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import SessionProvider from "@/components/SessionProvider";
import SmoothScroll from "@/components/SmoothScroll";
import { Analytics } from "@vercel/analytics/next";
import { siteUrl } from "@/lib/env";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });


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
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="min-h-full antialiased">
        <SessionProvider>
          <SmoothScroll>
            {children}
          </SmoothScroll>
        </SessionProvider>
        <Toaster richColors position="bottom-right" />
        <Analytics />
      </body>
    </html>
  );
}
