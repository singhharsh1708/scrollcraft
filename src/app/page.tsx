import { findPreset, PRESETS } from "@/lib/presets";
import HomeClient, { type FeaturedPreset } from "./HomeClient";

/**
 * Server shell for the landing page.
 *
 * The page needs a preset count and four fields from six presets. Importing the
 * catalogue from a client component shipped all 57 entries — 686 lines — into the
 * browser bundle to produce a number and six cards. Reading it here keeps it on the
 * server and passes down only what is rendered.
 */
const FEATURED_PRESET_NAMES = ["OrbitCRM", "TripVault", "Shopnest", "VisionForge", "StackForge", "Meridian"];

export default function Home() {
  const featured: FeaturedPreset[] = FEATURED_PRESET_NAMES
    .map((n) => findPreset(n))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({ name: p.name, category: p.category, style: p.style, colors: p.colors }));

  return <HomeClient presetCount={PRESETS.length} featured={featured} />;
}
