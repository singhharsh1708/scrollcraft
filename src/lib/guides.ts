import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";

export type Guide = { path: string; label: string; title: string; description: string };

export const GUIDES: Guide[] = [
  {
    path: "/scroll-animation",
    label: "Apple-style scroll animation",
    title: "How to make an Apple-style scroll animation",
    description:
      "How the image-sequence scroll effect on Apple product pages works, a live demo, the code to build one by hand, and how to make one without code.",
  },
  {
    path: "/video-scroll-animation",
    label: "Play a video on scroll",
    title: "Play a video on scroll: turn footage into a website",
    description:
      "Why scrubbing a video element on scroll stutters, how frame extraction fixes it, and how to turn your own clip into a scroll website in the browser.",
  },
  {
    path: "/website-builder-html-export",
    label: "Website builder with HTML export",
    title: "Free website builder that exports HTML",
    description:
      "Build a site in the browser with no sign-up, download it as plain HTML, CSS and JavaScript, and host it free on Netlify, Vercel or GitHub Pages.",
  },
];

export function guide(path: string): Guide {
  const g = GUIDES.find((x) => x.path === path);
  if (!g) throw new Error(`No guide at ${path}`);
  return g;
}

export function guideMeta(path: string): Metadata {
  const { title, description } = guide(path);
  return pageMeta({ title, description, path });
}
