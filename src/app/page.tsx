import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATES, templateCategories } from "@/lib/templates";
import { heroScenes } from "@/lib/heroScenes";
import HomeClient, { type EditorSample, type ExampleCard, type TemplateSlice } from "./HomeClient";
import type { HeroTemplate } from "@/components/HeroSequence";

// The root layout owns this page's title and share card; it only needs its address.
export const metadata: Metadata = { alternates: { canonical: "/" } };

/**
 * Server shell for the landing page.
 *
 * The page draws four template cards, one template's section list and two counts.
 * Importing the catalogue from a client component would ship every template's full copy
 * to the browser to produce that, so it is read here and only what is drawn is passed
 * down. The example manifest is read the same way: three of its fields are on the page,
 * and its palette notes are not.
 */
const PICK_SLUGS = ["kept", "ledger-fintech", "kiln-coffee", "northlight"];
const EDITOR_SLUG = "orbitcrm";
/**
 * The template the hero plays. Its wave background visibly moves as the visitor scrolls,
 * where the gradient templates read as one flat field. The hero sets its display face.
 */
const HERO_SLUG = "aurabeauty";

function examples(): ExampleCard[] {
  try {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "examples/manifest.json"), "utf8")
    ) as { slug: string; name: string; tagline: string }[];
    return manifest.map(({ slug, name, tagline }) => ({ slug, name, tagline }));
  } catch {
    return [];
  }
}

export default function Home() {
  const templates = PICK_SLUGS.map((slug) => TEMPLATES.find((t) => t.slug === slug))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .map((t): TemplateSlice => ({ slug: t.slug, name: t.name, category: t.category, style: t.style, colors: t.colors }));

  const sample = TEMPLATES.find((t) => t.slug === EDITOR_SLUG);
  const editorSample: EditorSample | null = sample
    ? {
        name: sample.name,
        slug: sample.slug,
        style: sample.style,
        colors: sample.colors,
        sections: sample.sections.map((s) => ({
          kind: s.kind ?? "text",
          heading: s.heading ?? "",
          eyebrow: s.eyebrow ?? "",
        })),
      }
    : null;

  const heroSource = TEMPLATES.find((t) => t.slug === HERO_SLUG) ?? TEMPLATES[0];
  const heroTemplate: HeroTemplate = {
    slug: heroSource.slug,
    name: heroSource.name,
    style: heroSource.style,
    colors: heroSource.colors,
    ink: heroSource.theme?.ink ?? "#f0f5f8",
    accent: heroSource.theme?.accent ?? "#7c3aed",
    scenes: heroScenes(heroSource.sections),
  };

  return (
    <HomeClient
      heroTemplate={heroTemplate}
      templates={templates}
      editorSample={editorSample}
      examples={examples()}
      stats={{ templates: TEMPLATES.length, categories: templateCategories().length }}
    />
  );
}
