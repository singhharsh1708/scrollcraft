import { string, object, array, tuple, enum as zEnum, type infer as zInfer } from "zod";
import { BACKGROUND_STYLES, MAX_SECTIONS } from "@/lib/siteSchema";
import { ALLOWED_IMAGE_TYPES, MAX_DESCRIPTION, MAX_IMAGES, MAX_IMAGE_BYTES } from "@/lib/briefLimits";

export { ALLOWED_IMAGE_TYPES, MAX_DESCRIPTION, MAX_IMAGES, MAX_IMAGE_BYTES };

/**
 * Turning a description into a site.
 *
 * The rules below are the ones the catalogue is held to, written for a model rather than
 * for a person. They exist because the failure mode here is not a crash: it is twenty
 * sites that read like each other, which is worth less than none.
 *
 * Nothing the model returns is trusted. It answers in a schema, the schema is validated,
 * and the result is validated again against the editor's own section schema before it
 * reaches anybody.
 */

/**
 * Pairings that exist on Google Fonts and read well together.
 *
 * A closed set on purpose. The schema below lets the model pick a pairing by name rather
 * than invent font names: an invented one with a hyphen or a full stop fails the editor's
 * own font rule, and that failure lands after the request has been paid for.
 */
export const BRIEF_FONT_PAIRS = [
  { display: "Archivo", body: "Inter" },
  { display: "Fraunces", body: "Karla" },
  { display: "Playfair Display", body: "Lato" },
  { display: "Space Grotesk", body: "Inter" },
  { display: "Bricolage Grotesque", body: "Instrument Sans" },
  { display: "Instrument Serif", body: "Inter Tight" },
  { display: "Oswald", body: "Roboto" },
  { display: "JetBrains Mono", body: "Public Sans" },
] as const;

export const FONT_PAIR_NAMES = BRIEF_FONT_PAIRS.map((p) => `${p.display} with ${p.body}`) as unknown as [string, ...string[]];

export function fontPairByName(name: string): (typeof BRIEF_FONT_PAIRS)[number] {
  const index = FONT_PAIR_NAMES.indexOf(name);
  return BRIEF_FONT_PAIRS[index === -1 ? 0 : index];
}

const hex = string().regex(/^#[0-9a-f]{6}$/i, "a six digit hex colour");

export const briefSectionSchema = object({
  kind: zEnum(["statement", "text"]),
  layout: zEnum(["center", "left", "right"]),
  reveal: zEnum(["mask", "fade", "stagger"]),
  eyebrow: string().min(2).max(60),
  heading: string().min(4).max(120),
  body: string().max(400),
  ctaLabel: string().max(40),
});

export const briefSchema = object({
  siteName: string().min(1).max(60),
  tagline: string().min(10).max(120),
  style: zEnum(BACKGROUND_STYLES),
  colors: tuple([hex, hex, hex]),
  fontPair: zEnum(FONT_PAIR_NAMES),
  ink: hex,
  accent: hex,
  accentText: hex,
  sections: array(briefSectionSchema).min(5).max(9),
});

export type Brief = zInfer<typeof briefSchema>;

/**
 * The house rules.
 *
 * Kept as one frozen string so it can be cached by the API across requests: a date, a
 * name or a request id in here would invalidate that cache on every call.
 */
export const BRIEF_RULES = `You write ScrollCraft sites: one scrolling page whose background is a generated canvas, with a few sections of copy pinned over it.

You are given a description of a business or person, and sometimes photographs of their work or premises. You return one site.

HOW THE COPY MUST READ

Write as the business, not about it. Every sentence must be one that only this business could say. Name the thing: the street, the material, the number of years, the size of the team, the hours, the price, the specific service. A sentence that would still make sense with another business's name in it has failed and must be rewritten.

Never write: "elevate", "unlock", "seamless", "cutting edge", "passionate about", "we pride ourselves", "take your X to the next level", "solutions", "journey", "transform your", "world class", "state of the art". Never write filler such as "lorem ipsum" or "your text here".

Say what the business will not do, or what it is not for, in one section. A page that only sells reads as a brochure; a page that declines something reads as a person.

Where the description is thin, write less rather than inventing. Do not invent awards, client names, testimonials, review scores, certifications, years in business, or numbers of customers. If the description gives you no numbers, write without numbers. An invented detail is worse than a general one.

If photographs are supplied, read what is actually in them (the room, the materials, the light, the work) and let that inform the copy and the palette. Do not describe the photographs; use them.

STRUCTURE

Five to nine sections. The first is kind "statement": the opening line somebody reads before they scroll, under about twelve words, with a call to action. The last section asks for the thing the business wants, booking, enquiry, visit, order, with its own call to action. In between, alternate layout between left and right, with at most one more centred section.

Each section carries an eyebrow of two to four words, a heading of under twelve words, and a body of two or three sentences. The opening statement section may leave body empty.

COLOUR AND TYPE

Choose three colours that come from this business's own world, as hex. The third is the dark ground the page settles to, and must be near black: every palette is painted over it. "ink" is the text colour and must be light enough to read on that ground. "accent" is a button background with white text on it, so it must be dark enough for that to be legible, around 5:1 or better. "accentText" is a lighter tint of the accent used for the eyebrow text, and must be light enough to read on the dark ground.

Pick the typeface pairing that suits the trade rather than the one that suits every trade. Choose "fontPair" from exactly these, by name: ${FONT_PAIR_NAMES.join("; ")}.

Choose the background style that matches the subject: "wave" for anything to do with water, cloth, movement or hospitality; "particles" for night, music, technology; "geometric" for architecture, engineering, manufacturing; "gradient" for software, health, anything clean and quiet.`;

/** Everything the request should contain, with the cheap checks done before any call. */
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export function checkBriefInput(input: { description?: unknown; images?: unknown }):
  | { ok: true; description: string; images: { media_type: AllowedImageType; data: string }[] }
  | { ok: false; error: string } {
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length < 20) return { ok: false, error: "Tell us a little more: at least a sentence or two about the business." };
  if (description.length > MAX_DESCRIPTION) return { ok: false, error: `Keep the description under ${MAX_DESCRIPTION} characters.` };

  const raw = Array.isArray(input.images) ? input.images : [];
  if (raw.length > MAX_IMAGES) return { ok: false, error: `Up to ${MAX_IMAGES} photographs.` };

  const images: { media_type: AllowedImageType; data: string }[] = [];
  for (const item of raw) {
    const image = item as { media_type?: unknown; data?: unknown };
    const type = String(image.media_type ?? "");
    const data = String(image.data ?? "");
    if (!ALLOWED_IMAGE_TYPES.includes(type as AllowedImageType)) {
      return { ok: false, error: "Photographs must be JPEG, PNG, WebP or GIF." };
    }
    // base64 carries four characters per three bytes.
    if (data.length * 0.75 > MAX_IMAGE_BYTES) {
      return { ok: false, error: `Each photograph must be under ${Math.round(MAX_IMAGE_BYTES / 1_000_000)} MB.` };
    }
    if (!/^[A-Za-z0-9+/=]+$/.test(data)) return { ok: false, error: "A photograph could not be read." };
    images.push({ media_type: type as AllowedImageType, data });
  }

  return { ok: true, description, images };
}

/** The brief as the editor's own shapes: sections, a style recipe and a theme. */
export function briefToSite(brief: Brief) {
  const pair = fontPairByName(brief.fontPair);
  const sections = brief.sections.slice(0, MAX_SECTIONS).map((section, i) => ({
    id: `section-${i}-generated`,
    kind: section.kind,
    layout: section.layout,
    reveal: section.reveal,
    eyebrow: section.eyebrow,
    heading: section.heading,
    body: section.body || undefined,
    ctaLabel: section.ctaLabel || undefined,
    ctaHref: section.ctaLabel ? "#contact" : undefined,
    scrollHeight: section.kind === "statement" ? 1300 : 1450,
  }));

  return {
    siteName: brief.siteName,
    siteDescription: brief.tagline,
    style: { style: brief.style, colors: brief.colors },
    theme: {
      fontDisplay: pair.display,
      fontBody: pair.body,
      ink: brief.ink,
      muted: `${brief.ink}bb`,
      accent: brief.accent,
      accentText: brief.accentText,
      scale: "editorial" as const,
    },
    sections,
  };
}
