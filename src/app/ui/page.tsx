import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import { KIT, KIT_BASE, KIT_TOKENS, KIT_TOKENS_LIGHT, kitPage } from "@/lib/componentKit";
import UiClient from "./UiClient";

export const metadata: Metadata = pageMeta({
  title: "Components",
  description: `${KIT.length} sections in plain HTML and CSS. Copy one, paste it into any page: no React, no Tailwind, no build step.`,
  path: "/ui",
});

/**
 * Server shell for the component kit.
 *
 * Each preview document is built here from the same registry the code blocks come from,
 * so the page cannot show one thing and copy another.
 */
export default function UiPage() {
  const pageFor = Object.fromEntries(
    KIT.map((c) => [c.id, { dark: kitPage([c], "dark"), light: kitPage([c], "light") }])
  );

  return (
    <UiClient
      components={KIT}
      tokens={KIT_TOKENS}
      lightTokens={KIT_TOKENS_LIGHT}
      base={KIT_BASE}
      pageFor={pageFor}
    />
  );
}
