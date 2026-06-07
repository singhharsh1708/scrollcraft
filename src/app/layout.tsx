import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import SessionProvider from "@/components/SessionProvider";
import SmoothScroll from "@/components/SmoothScroll";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const BASE_URL = "https://scrollcraft.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "ScrollCraft — AI Scroll Sites",
    template: "%s | ScrollCraft",
  },
  description: "Build immersive 2D scroll websites with animated canvas backgrounds. Pick a style, customise sections, export as pure HTML. No code needed.",
  keywords: ["scroll website builder", "animated canvas", "scrollytelling", "no-code", "AI website", "scroll animation"],
  authors: [{ name: "ScrollCraft" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: "ScrollCraft",
    title: "ScrollCraft — AI Scroll Sites",
    description: "Build immersive 2D scroll websites with animated canvas backgrounds. No code needed.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ScrollCraft" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ScrollCraft — AI Scroll Sites",
    description: "Build immersive 2D scroll websites with animated canvas backgrounds. No code needed.",
    images: ["/og-image.png"],
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
      </body>
    </html>
  );
}
