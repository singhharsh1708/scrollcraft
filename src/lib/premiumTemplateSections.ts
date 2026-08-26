import "server-only";
import type { Section } from "@/lib/siteSchema";
import type { Template } from "@/lib/templates";

/**
 * The withheld content of the premium templates: everything after the teaser.
 *
 * server-only, because lib/templates.ts is imported by client components and anything
 * placed there is readable by any visitor in the browser bundle. This is what a purchase
 * buys, so it is served only by the entitlement-checked route.
 *
 * The teaser is deliberately not repeated here. It lives once, in the public catalogue,
 * and fullTemplateSections() joins the two so the files cannot drift apart.
 */
const WITHHELD_SECTIONS: Record<string, Section[]> = {
  "meridian-watch": [
      { kind: "spacer", scrollHeight: 800 },
      {
        layout: "left", reveal: "stagger",
        eyebrow: "Movement",
        heading: "Eleven parts. Each one load bearing.",
        body: "No decoration, no filler plate, nothing added to look expensive. What you see holding the hands is what holds the hands.",
        scrollHeight: 1600,
      },
      {
        layout: "right", reveal: "fade",
        eyebrow: "Case",
        heading: "Brushed by hand, twice",
        body: "Once to flatten the mill marks, once at a right angle so the light moves across it rather than glinting off it.",
        scrollHeight: 1400,
      },
      {
        layout: "center", reveal: "scale",
        heading: "Four hundred made",
        body: "Then the tooling is retired.",
        ctaLabel: "Reserve one", ctaHref: "#reserve",
        scrollHeight: 1100,
      },
  ],
  "ledger-fintech": [
      {
        layout: "upper-third", reveal: "fade",
        eyebrow: "Coverage",
        heading: "Every account, one ledger",
        body: "Nineteen banks, six payment processors, and your own internal transfers, matched on the same rules engine.",
        scrollHeight: 1200,
      },
      {
        layout: "upper-third", reveal: "fade",
        eyebrow: "Audit",
        heading: "Every change has a name on it",
        body: "Immutable history, exportable in the format your auditor asks for rather than the one we prefer.",
        scrollHeight: 1200,
      },
      {
        layout: "center", reveal: "rise",
        heading: "See it against your own data",
        ctaLabel: "Book a walkthrough", ctaHref: "#demo",
        scrollHeight: 1000,
      },
  ],
  "harbour-estate": [
      {
        layout: "left", reveal: "stagger",
        eyebrow: "The house",
        heading: "Built in 1908, rewired in 2024",
        body: "Original floors, original windows, none of the original plumbing. Four bedrooms, two of them facing the estuary.",
        scrollHeight: 1400,
      },
      { kind: "spacer", scrollHeight: 800 },
      {
        layout: "right", reveal: "fade",
        eyebrow: "The village",
        heading: "A shop, a pub, and a train every hour",
        body: "Fifty-one minutes to the city, which is close enough to commute and far enough to hear the tide.",
        scrollHeight: 1300,
      },
      {
        layout: "center", reveal: "scale",
        heading: "Viewings from Saturday",
        ctaLabel: "Arrange a viewing", ctaHref: "#viewing",
        scrollHeight: 1000,
      },
  ],
  "aurabeauty": [
      { layout: "right", reveal: "stagger", eyebrow: "The science of glow", heading: "Backed by nature, proven by labs.", body: "We partner with climate-positive farms in France and Japan to source cold-pressed botanicals at their peak potency. Every batch is third-party tested before it reaches your skin.", scrollHeight: 1200 },
      { layout: "center", reveal: "fade", eyebrow: "Over 180,000 happy customers", heading: "Your ritual starts here.", body: "Free shipping on orders over $60. Easy returns. And a personalised skin consultation with every first order — because you deserve to feel certain.", ctaLabel: "Build your ritual", ctaHref: "#start", scrollHeight: 1200 },
  ],
  "nightrealm": [
      { layout: "left", reveal: "stagger", eyebrow: "Forge your legend", heading: "Every warrior is different.", body: "Choose from 12 character archetypes, unlock 340+ skills, and craft legendary weapons from materials found nowhere else. No two playthroughs are ever the same.", scrollHeight: 1200 },
      { layout: "center", reveal: "fade", eyebrow: "Join 8 million warriors", heading: "The Realm awaits.", body: "Free-to-play. Cross-platform. Available on PC, PS5, Xbox, and mobile. Your progress, your loot, your story — wherever you are.", ctaLabel: "Download now", ctaHref: "#start", scrollHeight: 1200 },
  ],
  "tripvault": [
      { layout: "left", reveal: "stagger", eyebrow: "Trip planning", heading: "Built by travellers, not spreadsheets.", body: "Say where you are going and TripVault assembles a day-by-day itinerary from places people actually went back to, with local restaurant picks and real-time price alerts.", scrollHeight: 1200 },
      { layout: "center", reveal: "fade", eyebrow: "4.9 stars · 2.1M downloads", heading: "Start your next chapter.", body: "Free for solo travellers. Pro plans for families and groups. Available on iOS and Android. Your passport never felt so organised.", ctaLabel: "Get it free", ctaHref: "#start", scrollHeight: 1200 },
  ],
  "greenshift": [
      { layout: "right", reveal: "stagger", eyebrow: "Verified impact", heading: "Carbon removal you can actually trust.", body: "Every tonne removed on GreenShift is independently verified by Gold Standard and Verra. Satellite imagery, IoT sensor data, and third-party audits — all in one transparent dashboard.", scrollHeight: 1200 },
      { layout: "center", reveal: "fade", eyebrow: "120+ enterprise partners", heading: "The net-zero future starts now.", body: "Microsoft, Shopify, and 118 other companies trust GreenShift to power their climate commitments. Join them — and mean it.", ctaLabel: "Get started", ctaHref: "#start", scrollHeight: 1200 },
  ],
  "ember": [
      { layout: "left", reveal: "stagger", eyebrow: "The craft", heading: "Fire is the only seasoning we need.", body: "We use a custom-built 900°C ceramic hearth to achieve a crust that no pan can replicate. Our menu changes with the season. Our commitment to quality never does.", scrollHeight: 1200 },
      { layout: "center", reveal: "fade", eyebrow: "Downtown, Tuesday–Saturday", heading: "A meal worth the occasion.", body: "Dinner service from 6 pm. Tasting menu available Wednesday through Friday. Private dining for up to 14 guests. Sommelier-curated wine list included.", ctaLabel: "Make a reservation", ctaHref: "#start", scrollHeight: 1200 },
  ],
};

/** Sections withheld from the public catalogue, or null when the slug is not premium. */
export function withheldSectionsFor(slug: string): Section[] | null {
  return WITHHELD_SECTIONS[slug] ?? null;
}

/**
 * The complete template as a buyer receives it: public teaser then withheld remainder.
 * A free template is already complete and is returned unchanged.
 */
export function fullTemplateSections(t: Template): Section[] {
  const rest = withheldSectionsFor(t.slug);
  return rest ? [...t.sections, ...rest] : t.sections;
}
