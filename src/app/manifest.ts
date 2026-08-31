import type { MetadataRoute } from "next";

/**
 * Served at /manifest.webmanifest and linked automatically. With this and the icons
 * beside it, the app is installable and stops falling back to a screenshot-of-a-letter
 * on home screens and in app switchers.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ScrollCraft",
    short_name: "ScrollCraft",
    description: "Build cinematic scroll websites in the browser and export them as plain HTML.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#0a0a0f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
