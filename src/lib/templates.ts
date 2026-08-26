import type { Style2D } from "@/lib/generate2DFrames";
import type { Section } from "@/lib/siteSchema";

export interface TemplateTheme {
  fontDisplay?: string;
  fontBody?: string;
  scale?: "compact" | "editorial" | "poster";
  displayWeight?: number;
  displayCase?: "none" | "upper";
  displayTracking?: number;
  ink?: string;
  muted?: string;
  accent?: string;
  accentText?: string;
  radius?: number;
}

export interface Template {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  tags: string[];
  style: Style2D;
  colors: [string, string, string];
  /** Tailwind gradient for the gallery card, so a card reads before frames render. */
  gradient: string;
  theme: TemplateTheme;
  /**
   * The sections anyone may see.
   *
   * For a premium template this is the opening section only. The rest is the thing
   * being sold, so it lives in `premiumTemplateSections.ts`, which is server-only.
   * Gating it in the UI alone would be theatre: this module is imported by six client
   * components, so whatever sits here ships to every visitor in the browser bundle.
   */
  sections: Section[];
  /** Charged for individually. Its remaining sections are served only after purchase. */
  premium?: true;
  /**
   * What the gallery should say about a premium template, since `sections` holds only
   * the teaser and counting it would understate the template. Numbers only — they
   * describe the withheld content without revealing any of it.
   */
  fullSectionCount?: number;
  fullScrollHeight?: number;
}

const INTRO_BUFFER = 1000;

/**
 * Matches the exporter and the skill: the leading spacer plus every section's own track.
 * A premium template carries the real total separately, because `sections` is its teaser.
 */
export function templateScrollHeight(t: Template): number {
  if (t.fullScrollHeight) return t.fullScrollHeight + INTRO_BUFFER;
  return t.sections.reduce((acc, s) => acc + (s.scrollHeight ?? 1000), 0) + INTRO_BUFFER;
}

/** Content sections a visitor gets, counting the withheld ones for a premium template. */
export function templateSectionCount(t: Template): number {
  return t.fullSectionCount ?? t.sections.filter((s) => s.kind !== "spacer").length;
}

export function templateBySlug(slug: string): Template | undefined {
  return TEMPLATES.find((t) => t.slug === slug);
}

export function templateCategories(): string[] {
  return [...new Set(TEMPLATES.map((t) => t.category))].sort();
}

export const TEMPLATES: Template[] = [
  {
    slug: "orbitcrm",
    name: "OrbitCRM",
    tagline: "A revenue tool that reads like an argument, not a feature list",
    category: "SaaS",
    tags: ["Dark", "Violet", "Product-led"],
    style: "gradient",
    colors: ["#7c3aed", "#2563eb", "#0f172a"],
    gradient: "from-violet-800 via-purple-900 to-violet-950",
    theme: {
      fontDisplay: "Archivo", fontBody: "IBM Plex Sans", scale: "editorial",
      displayWeight: 800, ink: "#f1eefb", muted: "rgba(241,238,251,0.72)",
      accent: "#5b34a8", accentText: "#d6c6f5", radius: 8,
    },
    sections: [
      {
        kind: "statement", layout: "center", reveal: "mask",
        eyebrow: "Introducing OrbitCRM",
        heading: "Close deals at the speed of light.",
        scrollHeight: 1400,
      },
      {
        layout: "left", reveal: "stagger",
        eyebrow: "Pipeline",
        heading: "Your pipeline, finally alive",
        body: "Drag-and-drop stages, real-time probability scoring, and next-step suggestions drawn from the deals your team already won.",
        scrollHeight: 1500,
      },
      { kind: "spacer", scrollHeight: 700 },
      {
        layout: "right", reveal: "fade",
        eyebrow: "Trusted by 4,200 teams",
        heading: "Scales past the point most tools break",
        body: "SOC 2 Type II, 99.99% uptime, and an audit log your security reviewer will actually accept.",
        scrollHeight: 1300,
      },
      {
        layout: "center", reveal: "scale",
        heading: "Start closing this week",
        ctaLabel: "Start free trial", ctaHref: "#signup",
        scrollHeight: 1000,
      },
    ],
  },
  {
    slug: "atlas-studio",
    name: "Atlas Studio",
    tagline: "A design studio page that lets the work do the talking",
    category: "Agency",
    tags: ["Editorial", "Serif", "Restrained"],
    style: "wave",
    colors: ["#0b1f2a", "#14505f", "#061218"],
    gradient: "from-slate-800 via-teal-900 to-slate-950",
    theme: {
      fontDisplay: "Playfair Display", fontBody: "Lato", scale: "poster",
      displayWeight: 700, displayTracking: -0.025, ink: "#f3f1ea",
      muted: "rgba(243,241,234,0.7)", accent: "#1f6b74", accentText: "#a7dbe0", radius: 0,
    },
    sections: [
      {
        kind: "statement", layout: "lower-third", reveal: "mask",
        heading: "We build the thing you cannot stop looking at.",
        scrollHeight: 1600,
      },
      {
        layout: "lower-third", reveal: "stagger",
        eyebrow: "How we work",
        heading: "Six weeks, one team, no handoff",
        body: "Strategy, design and build in the same room. Nothing gets thrown over a wall, so nothing arrives diluted.",
        scrollHeight: 1500,
      },
      { kind: "spacer", scrollHeight: 900 },
      {
        kind: "statement", layout: "center", reveal: "scale",
        heading: "Selected work, 2019 to now.",
        scrollHeight: 1400,
      },
      {
        layout: "center", reveal: "fade",
        heading: "Tell us what you are making",
        ctaLabel: "Start a project", ctaHref: "#contact",
        scrollHeight: 1000,
      },
    ],
  },
  {
    slug: "meridian-watch",
    name: "Meridian",
    tagline: "A single-product page built around one object",
    category: "Product",
    tags: ["Luxury", "Warm", "Minimal"],
    style: "gradient",
    colors: ["#1a0f07", "#7a3d10", "#0d0704"],
    gradient: "from-amber-900 via-orange-950 to-stone-950",
    theme: {
      fontDisplay: "Archivo", fontBody: "IBM Plex Sans", scale: "poster",
      displayWeight: 800, displayCase: "upper", displayTracking: -0.02,
      ink: "#f7efe6", muted: "rgba(247,239,230,0.7)",
      accent: "#a94b0d", accentText: "#f8c9aa", radius: 2,
    },
    premium: true,
    fullSectionCount: 4,
    fullScrollHeight: 6400,
    sections: [
      {
        kind: "statement", layout: "center", reveal: "mask",
        eyebrow: "Meridian 01",
        heading: "Machined from one billet.",
        scrollHeight: 1500,
      },
    ],
  },
  {
    slug: "kiln-coffee",
    name: "Kiln",
    tagline: "A roastery page that smells like the room",
    category: "Food & Drink",
    tags: ["Warm", "Editorial", "Craft"],
    style: "particles",
    colors: ["#160d08", "#6b3418", "#0b0605"],
    gradient: "from-orange-950 via-amber-950 to-stone-950",
    theme: {
      fontDisplay: "Fraunces", fontBody: "Karla", scale: "editorial",
      displayWeight: 700, displayTracking: -0.02, ink: "#f6ece2",
      muted: "rgba(246,236,226,0.72)", accent: "#8a4318", accentText: "#f2c39c", radius: 12,
    },
    sections: [
      {
        kind: "statement", layout: "lower-third", reveal: "fade",
        eyebrow: "Kiln Roastery",
        heading: "Roasted this morning. Ground when you order.",
        scrollHeight: 1400,
      },
      {
        layout: "left", reveal: "stagger",
        eyebrow: "Sourcing",
        heading: "Two farms. Both on first-name terms.",
        body: "We buy the whole lot or none of it, which means the price is agreed before harvest and the farmer is not gambling on us.",
        scrollHeight: 1500,
      },
      {
        layout: "right", reveal: "fade",
        eyebrow: "The roast",
        heading: "Light enough to taste the fruit",
        body: "Anything darker is a decision to hide the bean. We would rather sell you something that tastes of where it grew.",
        scrollHeight: 1400,
      },
      {
        layout: "center", reveal: "scale",
        heading: "Subscribe, or just try a bag",
        ctaLabel: "Order coffee", ctaHref: "#shop",
        scrollHeight: 1000,
      },
    ],
  },
  {
    slug: "northlight",
    name: "Northlight",
    tagline: "A photographer's portfolio that gets out of the way",
    category: "Portfolio",
    tags: ["Cold", "Quiet", "Image-led"],
    style: "wave",
    colors: ["#050a12", "#123a52", "#02060b"],
    gradient: "from-sky-950 via-slate-900 to-black",
    theme: {
      fontDisplay: "Space Grotesk", fontBody: "Inter", scale: "compact",
      displayWeight: 600, displayTracking: 0.01, ink: "#e9f1f6",
      muted: "rgba(233,241,246,0.68)", accent: "#1f5f78", accentText: "#a9d9ec", radius: 4,
    },
    sections: [
      {
        layout: "lower-third", reveal: "fade",
        eyebrow: "Northlight",
        heading: "Landscape work, mostly at dawn",
        body: "Iceland, the Faroes, and a lot of waiting in cars.",
        scrollHeight: 1300,
      },
      { kind: "spacer", scrollHeight: 800 },
      {
        layout: "lower-third", reveal: "fade",
        eyebrow: "Series 01",
        heading: "Sixty-one days of the same shoreline",
        body: "Same tripod holes, same hour, every day through a winter. The interesting part is how little repeats.",
        scrollHeight: 1500,
      },
      {
        layout: "lower-third", reveal: "fade",
        eyebrow: "Prints",
        heading: "Editions of nine",
        body: "Hand-printed, signed on the back, shipped flat.",
        scrollHeight: 1200,
      },
      {
        layout: "center", reveal: "rise",
        heading: "Commissions open for spring",
        ctaLabel: "Get in touch", ctaHref: "#contact",
        scrollHeight: 1000,
      },
    ],
  },
  {
    slug: "signal-conf",
    name: "Signal",
    tagline: "A conference page that answers the only three questions",
    category: "Event",
    tags: ["Bold", "Cyan", "Dated"],
    style: "geometric",
    colors: ["#03121a", "#0a5f6e", "#010a0f"],
    gradient: "from-cyan-900 via-teal-950 to-slate-950",
    theme: {
      fontDisplay: "Oswald", fontBody: "Roboto", scale: "poster",
      displayWeight: 600, displayCase: "upper", displayTracking: 0.015,
      ink: "#e6f6f8", muted: "rgba(230,246,248,0.7)",
      accent: "#12666f", accentText: "#9fe3ec", radius: 0,
    },
    sections: [
      {
        kind: "statement", layout: "center", reveal: "mask",
        eyebrow: "March 14 to 16 · Lisbon",
        heading: "Signal 2027",
        scrollHeight: 1500,
      },
      {
        layout: "left", reveal: "stagger",
        eyebrow: "Programme",
        heading: "Three days, one track, no parallel sessions",
        body: "Everyone sees the same talks, so the hallway conversation is about the thing you all just watched.",
        scrollHeight: 1400,
      },
      {
        layout: "right", reveal: "fade",
        eyebrow: "Speakers",
        heading: "Twenty-two people who build things",
        body: "No keynote sponsors, no vendor pitches. If someone is on stage it is because they shipped something.",
        scrollHeight: 1400,
      },
      {
        layout: "center", reveal: "scale",
        eyebrow: "Tickets",
        heading: "Four hundred seats",
        ctaLabel: "Get a ticket", ctaHref: "#tickets",
        scrollHeight: 1000,
      },
    ],
  },
  {
    slug: "quarry-fitness",
    name: "Quarry",
    tagline: "A gym page with no stock photography energy",
    category: "Fitness",
    tags: ["Hard", "Monochrome", "Direct"],
    style: "geometric",
    colors: ["#0a0c0f", "#2b343d", "#050607"],
    gradient: "from-zinc-800 via-slate-900 to-black",
    theme: {
      fontDisplay: "Oswald", fontBody: "Roboto", scale: "poster",
      displayWeight: 700, displayCase: "upper", displayTracking: 0.02,
      ink: "#eef1f4", muted: "rgba(238,241,244,0.68)",
      accent: "#4b555f", accentText: "#c9d3dc", radius: 0,
    },
    sections: [
      {
        kind: "statement", layout: "lower-third", reveal: "mask",
        heading: "It is going to be hard. That is the product.",
        scrollHeight: 1500,
      },
      {
        layout: "left", reveal: "stagger",
        eyebrow: "Coaching",
        heading: "One coach, twelve people, no mirrors",
        body: "You get corrected out loud, in front of everyone, because that is the fastest way to stop doing it wrong.",
        scrollHeight: 1400,
      },
      { kind: "spacer", scrollHeight: 700 },
      {
        layout: "right", reveal: "fade",
        eyebrow: "Membership",
        heading: "Month to month, cancel whenever",
        body: "No twelve-month contract. If it stops being worth it, leaving should be easy.",
        scrollHeight: 1300,
      },
      {
        layout: "center", reveal: "scale",
        heading: "First session is free",
        ctaLabel: "Book it", ctaHref: "#book",
        scrollHeight: 1000,
      },
    ],
  },
  {
    slug: "ledger-fintech",
    name: "Ledger",
    tagline: "A fintech page that leads with the number",
    category: "SaaS",
    tags: ["Cool", "Dense", "Technical"],
    style: "gradient",
    colors: ["#02110f", "#0c4a42", "#010807"],
    gradient: "from-emerald-900 via-teal-950 to-black",
    theme: {
      fontDisplay: "Space Grotesk", fontBody: "Inter", scale: "compact",
      displayWeight: 700, ink: "#e8f5f1", muted: "rgba(232,245,241,0.7)",
      accent: "#0f5f55", accentText: "#93dccf", radius: 6,
    },
    premium: true,
    fullSectionCount: 4,
    fullScrollHeight: 4600,
    sections: [
      {
        layout: "upper-third", reveal: "fade",
        eyebrow: "Ledger",
        heading: "Close the month in four days, not fourteen",
        body: "Reconciliation that runs continuously instead of in a panic at quarter end.",
        scrollHeight: 1200,
      },
    ],
  },
  {
    slug: "harbour-estate",
    name: "Harbour",
    tagline: "A property listing that sells the view, not the square footage",
    category: "Real Estate",
    tags: ["Calm", "Blue", "Spacious"],
    style: "wave",
    colors: ["#04121c", "#11526b", "#020a10"],
    gradient: "from-sky-900 via-slate-900 to-slate-950",
    theme: {
      fontDisplay: "Playfair Display", fontBody: "Lato", scale: "editorial",
      displayWeight: 700, displayTracking: -0.02, ink: "#f0f5f8",
      muted: "rgba(240,245,248,0.72)", accent: "#1a5d78", accentText: "#a6d7e8", radius: 10,
    },
    premium: true,
    fullSectionCount: 4,
    fullScrollHeight: 6000,
    sections: [
      {
        kind: "statement", layout: "lower-third", reveal: "mask",
        eyebrow: "Harbour House",
        heading: "The water is forty metres away.",
        scrollHeight: 1500,
      },
    ],
  },
  {
    slug: "field-notes",
    name: "Field Notes",
    tagline: "A long-form essay layout for one piece of writing",
    category: "Editorial",
    tags: ["Quiet", "Serif", "Text-first"],
    style: "particles",
    colors: ["#0a0910", "#2d2543", "#050409"],
    gradient: "from-indigo-950 via-slate-900 to-black",
    theme: {
      fontDisplay: "Fraunces", fontBody: "Karla", scale: "editorial",
      displayWeight: 600, displayTracking: -0.015, ink: "#f0edf7",
      muted: "rgba(240,237,247,0.72)", accent: "#4a3a7a", accentText: "#cfc3ee", radius: 14,
    },
    sections: [
      {
        layout: "lower-third", reveal: "fade",
        eyebrow: "Essay · 12 min",
        heading: "What we lost when maps stopped being wrong",
        scrollHeight: 1400,
      },
      {
        layout: "lower-third", reveal: "stagger",
        heading: "Part one: the blank spaces",
        body: "A map that admits it does not know something is more honest than one that quietly guesses. We traded the first for the second and called it progress.",
        scrollHeight: 1600,
      },
      { kind: "spacer", scrollHeight: 900 },
      {
        layout: "lower-third", reveal: "stagger",
        heading: "Part two: the cost of certainty",
        body: "Every seam smoothed over is a decision someone made on your behalf, in a room you were not in, about a place you are about to walk through.",
        scrollHeight: 1600,
      },
      {
        layout: "center", reveal: "scale",
        heading: "Subscribe for the next one",
        ctaLabel: "Get essays by email", ctaHref: "#subscribe",
        scrollHeight: 1000,
      },
    ],
  },
  {
    slug: "pulse-app",
    name: "Pulse",
    tagline: "A mobile app launch page, one feature per screen",
    category: "Product",
    tags: ["Vivid", "Playful", "App"],
    style: "particles",
    colors: ["#0b0418", "#5b1f8a", "#060210"],
    gradient: "from-fuchsia-900 via-purple-950 to-black",
    theme: {
      fontDisplay: "Archivo", fontBody: "Inter", scale: "poster",
      displayWeight: 800, displayTracking: -0.03, ink: "#f6eefb",
      muted: "rgba(246,238,251,0.72)", accent: "#7a3aa8", accentText: "#e2c2f5", radius: 20,
    },
    sections: [
      {
        kind: "statement", layout: "center", reveal: "scale",
        eyebrow: "Pulse",
        heading: "Your week, on one screen.",
        scrollHeight: 1400,
      },
      {
        layout: "left", reveal: "stagger",
        eyebrow: "Planning",
        heading: "Plan in minutes, not evenings",
        body: "Drag a block, drop it on a day. That is the whole interaction, and it is deliberately the only one.",
        scrollHeight: 1300,
      },
      {
        layout: "right", reveal: "stagger",
        eyebrow: "Focus",
        heading: "One thing at a time, enforced",
        body: "Pulse hides everything you are not doing right now. You can turn that off. You will turn it back on.",
        scrollHeight: 1300,
      },
      {
        layout: "center", reveal: "mask",
        heading: "Free while we are in beta",
        ctaLabel: "Get the app", ctaHref: "#download",
        scrollHeight: 1000,
      },
    ],
  },
  {
    slug: "cinder-restaurant",
    name: "Cinder",
    tagline: "A restaurant page that reads like the menu",
    category: "Food & Drink",
    tags: ["Dark", "Ember", "Intimate"],
    style: "gradient",
    colors: ["#120604", "#5e2109", "#080302"],
    gradient: "from-red-950 via-orange-950 to-black",
    theme: {
      fontDisplay: "Playfair Display", fontBody: "Lato", scale: "poster",
      displayWeight: 700, displayTracking: -0.02, ink: "#f8ece3",
      muted: "rgba(248,236,227,0.7)", accent: "#973f11", accentText: "#f6c4a0", radius: 4,
    },
    sections: [
      {
        kind: "statement", layout: "lower-third", reveal: "mask",
        eyebrow: "Cinder",
        heading: "Everything here touched fire.",
        scrollHeight: 1500,
      },
      {
        layout: "left", reveal: "stagger",
        eyebrow: "The kitchen",
        heading: "One hearth, no gas, no induction",
        body: "Twelve dishes a night because that is what one fire can do properly. The menu changes when the delivery does.",
        scrollHeight: 1400,
      },
      { kind: "spacer", scrollHeight: 700 },
      {
        layout: "right", reveal: "fade",
        eyebrow: "The room",
        heading: "Twenty-six seats, one long table",
        body: "You will be sitting next to someone you do not know. Most people decide they like this by the second course.",
        scrollHeight: 1300,
      },
      {
        layout: "center", reveal: "scale",
        heading: "Bookings open on the first",
        ctaLabel: "Reserve a seat", ctaHref: "#book",
        scrollHeight: 1000,
      },
    ],
  },
  {
    slug: "beacon-nonprofit",
    name: "Beacon",
    tagline: "A cause page that asks once, clearly",
    category: "Nonprofit",
    tags: ["Warm", "Human", "Direct"],
    style: "wave",
    colors: ["#0c1108", "#3d5417", "#050803"],
    gradient: "from-lime-950 via-green-950 to-black",
    theme: {
      fontDisplay: "Archivo", fontBody: "IBM Plex Sans", scale: "editorial",
      displayWeight: 700, ink: "#f0f4e9", muted: "rgba(240,244,233,0.72)",
      accent: "#3f5c1a", accentText: "#c6dfa0", radius: 8,
    },
    sections: [
      {
        kind: "statement", layout: "center", reveal: "fade",
        eyebrow: "Beacon",
        heading: "Eleven thousand homes still have no meter.",
        scrollHeight: 1400,
      },
      {
        layout: "left", reveal: "stagger",
        eyebrow: "What we do",
        heading: "We install, then we leave",
        body: "No ongoing fee, no data harvesting, no branding on the box. The household owns the meter from the day it goes in.",
        scrollHeight: 1400,
      },
      {
        layout: "right", reveal: "fade",
        eyebrow: "Where it goes",
        heading: "Ninety-one pence in the pound",
        body: "Published quarterly, audited annually, and broken down per district so you can see the one nearest you.",
        scrollHeight: 1300,
      },
      {
        layout: "center", reveal: "scale",
        heading: "Fund a meter",
        body: "Forty pounds covers one installation.",
        ctaLabel: "Donate", ctaHref: "#donate",
        scrollHeight: 1000,
      },
    ],
  },
  {
    slug: "vellum-books",
    name: "Vellum",
    tagline: "A book launch page with room to breathe",
    category: "Editorial",
    tags: ["Paper", "Serif", "Slow"],
    style: "particles",
    colors: ["#100c07", "#4a3a22", "#070502"],
    gradient: "from-yellow-950 via-stone-900 to-black",
    theme: {
      fontDisplay: "Fraunces", fontBody: "Karla", scale: "poster",
      displayWeight: 700, displayTracking: -0.03, ink: "#f5efe3",
      muted: "rgba(245,239,227,0.72)", accent: "#6d5324", accentText: "#e3cfa3", radius: 6,
    },
    sections: [
      {
        kind: "statement", layout: "center", reveal: "mask",
        eyebrow: "Out in April",
        heading: "The Salt Road",
        scrollHeight: 1600,
      },
      { kind: "spacer", scrollHeight: 900 },
      {
        layout: "lower-third", reveal: "stagger",
        eyebrow: "The book",
        heading: "Four hundred pages, one journey",
        body: "A trade route, the people who kept it open, and what happened in the eighty years after it closed.",
        scrollHeight: 1500,
      },
      {
        layout: "center", reveal: "fade",
        heading: "Signed first editions",
        body: "Numbered to five hundred.",
        ctaLabel: "Pre-order", ctaHref: "#preorder",
        scrollHeight: 1100,
      },
    ],
  },
  {
    slug: "forge-devtool",
    name: "Forge",
    tagline: "A developer tool page written for people who read docs",
    category: "SaaS",
    tags: ["Terminal", "Dense", "Technical"],
    style: "geometric",
    colors: ["#060810", "#1f2a44", "#03040a"],
    gradient: "from-slate-800 via-indigo-950 to-black",
    theme: {
      fontDisplay: "Space Grotesk", fontBody: "Inter", scale: "compact",
      displayWeight: 700, ink: "#e9ecf6", muted: "rgba(233,236,246,0.7)",
      accent: "#2f3f6b", accentText: "#aebbe6", radius: 4,
    },
    sections: [
      {
        layout: "upper-third", reveal: "fade",
        eyebrow: "Forge",
        heading: "Builds that finish before you switch tabs",
        body: "Content-addressed caching, so the second build of anything is a lookup.",
        scrollHeight: 1200,
      },
      {
        layout: "upper-third", reveal: "fade",
        eyebrow: "How",
        heading: "Nothing runs twice",
        body: "Every task is keyed on its inputs. Change one file and exactly the work that depends on it re-runs.",
        scrollHeight: 1200,
      },
      {
        layout: "upper-third", reveal: "fade",
        eyebrow: "Adoption",
        heading: "One file, then delete it if you hate it",
        body: "Forge reads your existing scripts. There is no migration and no lock-in to unwind.",
        scrollHeight: 1200,
      },
      {
        layout: "center", reveal: "rise",
        heading: "Try it on your slowest repo",
        ctaLabel: "Read the docs", ctaHref: "#docs",
        scrollHeight: 1000,
      },
    ],
  },
  {
    slug: "solstice-travel",
    name: "Solstice",
    tagline: "A travel page that sells one trip properly",
    category: "Travel",
    tags: ["Golden", "Wide", "Cinematic"],
    style: "gradient",
    colors: ["#150c04", "#8a5310", "#0a0602"],
    gradient: "from-amber-800 via-orange-900 to-stone-950",
    theme: {
      fontDisplay: "Playfair Display", fontBody: "Lato", scale: "poster",
      displayWeight: 700, displayTracking: -0.025, ink: "#f9f0e2",
      muted: "rgba(249,240,226,0.72)", accent: "#8d5311", accentText: "#f4cf9c", radius: 16,
    },
    sections: [
      {
        kind: "statement", layout: "lower-third", reveal: "mask",
        eyebrow: "Nine days · Atacama",
        heading: "The driest place that still has a sky.",
        scrollHeight: 1600,
      },
      {
        layout: "left", reveal: "stagger",
        eyebrow: "The route",
        heading: "Three valleys, one salt flat, no coaches",
        body: "Small vehicles, local guides, and the kind of pace that lets you stop when the light does something.",
        scrollHeight: 1500,
      },
      { kind: "spacer", scrollHeight: 800 },
      {
        layout: "right", reveal: "fade",
        eyebrow: "Nights",
        heading: "Two of them outside",
        body: "At four thousand metres with no town for eighty kilometres, which is the entire reason to come.",
        scrollHeight: 1300,
      },
      {
        layout: "center", reveal: "scale",
        heading: "Eight travellers per departure",
        ctaLabel: "See dates", ctaHref: "#dates",
        scrollHeight: 1000,
      },
    ],
  },
  {
    slug: "aurabeauty",
    name: "AuraBeauty",
    tagline: "Luxury skincare, delivered to your door",
    category: "E-commerce",
    tags: ["Rose", "Luxury", "Retail"],
    style: "wave",
    colors: ["#ec4899", "#f43f5e", "#1a0510"],
    gradient: "from-pink-700 via-rose-800 to-pink-900",
    theme: { fontDisplay: "Playfair Display", fontBody: "Lato", scale: "poster", displayWeight: 700, displayTracking: -0.025, ink: "#fdeef5", muted: "rgba(253,238,245,0.72)", accent: "#b33774", accentText: "#fdc7e2", radius: 18 },
    premium: true,
    fullSectionCount: 3,
    fullScrollHeight: 3800,
    sections: [
      { kind: "statement", layout: "center", reveal: "mask", eyebrow: "New collection", heading: "Radiance, redefined.", ctaLabel: "Shop now", ctaHref: "#start", scrollHeight: 1400 },
    ],
  },
  {
    slug: "nightrealm",
    name: "NightRealm",
    tagline: "Enter the world beyond the veil",
    category: "Gaming",
    tags: ["Neon", "Gaming", "Loud"],
    style: "particles",
    colors: ["#6d28d9", "#1e1b4b", "#030014"],
    gradient: "from-purple-800 via-indigo-900 to-purple-950",
    theme: { fontDisplay: "Oswald", fontBody: "Roboto", scale: "poster", displayWeight: 700, displayCase: "upper", displayTracking: 0.01, ink: "#eae7fb", muted: "rgba(234,231,251,0.7)", accent: "#6d28d9", accentText: "#e0cefd", radius: 2 },
    premium: true,
    fullSectionCount: 3,
    fullScrollHeight: 3800,
    sections: [
      { kind: "statement", layout: "center", reveal: "mask", eyebrow: "Season III — The Veil War", heading: "Darkness has a name.", ctaLabel: "Play free", ctaHref: "#start", scrollHeight: 1400 },
    ],
  },
  {
    slug: "tripvault",
    name: "TripVault",
    tagline: "Every adventure, beautifully organised",
    category: "Mobile App",
    tags: ["Sky", "App", "Friendly"],
    style: "gradient",
    colors: ["#0284c7", "#0891b2", "#020c1a"],
    gradient: "from-sky-700 via-blue-800 to-indigo-900",
    theme: { fontDisplay: "Space Grotesk", fontBody: "Inter", scale: "editorial", displayWeight: 700, ink: "#e8f4fb", muted: "rgba(232,244,251,0.72)", accent: "#026ca3", accentText: "#abddf7", radius: 14 },
    premium: true,
    fullSectionCount: 3,
    fullScrollHeight: 3800,
    sections: [
      { kind: "statement", layout: "center", reveal: "mask", eyebrow: "Travel smarter", heading: "Your whole trip in one tap.", ctaLabel: "Download TripVault", ctaHref: "#start", scrollHeight: 1400 },
    ],
  },
  {
    slug: "greenshift",
    name: "GreenShift",
    tagline: "Climate technology for a liveable planet",
    category: "Startup",
    tags: ["Green", "Climate", "Earnest"],
    style: "wave",
    colors: ["#059669", "#0d9488", "#021a10"],
    gradient: "from-green-700 via-lime-800 to-green-950",
    theme: { fontDisplay: "Archivo", fontBody: "IBM Plex Sans", scale: "editorial", displayWeight: 800, ink: "#e9f7f1", muted: "rgba(233,247,241,0.72)", accent: "#047653", accentText: "#91e7cc", radius: 10 },
    premium: true,
    fullSectionCount: 3,
    fullScrollHeight: 3800,
    sections: [
      { kind: "statement", layout: "center", reveal: "mask", eyebrow: "Series B — $42M raised", heading: "Decarbonisation at enterprise scale.", ctaLabel: "Book a demo", ctaHref: "#start", scrollHeight: 1400 },
    ],
  },
  {
    slug: "ember",
    name: "Ember",
    tagline: "Fire-crafted steakhouse, downtown",
    category: "Restaurant",
    tags: ["Fire", "Hospitality", "Warm"],
    style: "particles",
    colors: ["#ea580c", "#b91c1c", "#1a0500"],
    gradient: "from-orange-700 via-red-800 to-orange-950",
    theme: { fontDisplay: "Fraunces", fontBody: "Karla", scale: "poster", displayWeight: 700, displayTracking: -0.02, ink: "#fbeee6", muted: "rgba(251,238,230,0.72)", accent: "#b24309", accentText: "#fcccb4", radius: 6 },
    premium: true,
    fullSectionCount: 3,
    fullScrollHeight: 3800,
    sections: [
      { kind: "statement", layout: "center", reveal: "mask", eyebrow: "Now taking reservations", heading: "Some things are better burnt.", ctaLabel: "Reserve a table", ctaHref: "#start", scrollHeight: 1400 },
    ],
  },
];
