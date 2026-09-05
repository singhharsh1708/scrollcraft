/**
 * Imported by name rather than as the `z` namespace.
 *
 * `import { z } from "zod"` binds a namespace object, which the bundler has to keep
 * whole — including `z.locales`, all 53 of them. This module is reachable from the
 * editor and the gallery, so that was 41.6 KiB of translated validation messages, in
 * languages this app does not speak, on the two heaviest routes.
 */
import { string, number, boolean, object, array, tuple, enum as zEnum, type infer as zInfer, type ZodType } from "zod";

export const SECTION_LAYOUTS = ["center", "left", "right", "lower-third", "upper-third"] as const;
export type SectionLayout = (typeof SECTION_LAYOUTS)[number];

export const SECTION_KINDS = ["text", "statement", "spacer"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const REVEALS = ["rise", "fade", "mask", "stagger", "scale", "none"] as const;
export type Reveal = (typeof REVEALS)[number];

export const MAX_SECTIONS = 100;

export const sectionIdSchema = string().min(1).max(100);

export const colorSchema = string().max(50)
  .regex(/^(?:#[0-9a-fA-F]{3,8}|(?:rgb|hsl)a?\([\d\s.,%/]+\)|[a-zA-Z]{3,20})$/);

export const ctaHrefSchema = string().max(2000)
  .refine((v) => v === "" || /^(?:#|\/|\.{1,2}\/|https?:\/\/|mailto:|tel:)/i.test(v));

export const imageSrcSchema = string().max(2000)
  .refine((v) => v === "" || /^(?:https?:\/\/|\/|\.{1,2}\/|assets\/)/i.test(v), {
    message: "image must be an http(s) URL or a relative path",
  });

export const TYPE_SCALE_KEYS = ["compact", "editorial", "poster"] as const;

export const BACKGROUND_STYLES = ["gradient", "geometric", "particles", "wave"] as const;

// The family name is interpolated into a Google Fonts stylesheet URL, so the charset is
// constrained rather than escaped.
export const fontFamilySchema = string().min(1).max(60).regex(/^[A-Za-z0-9][A-Za-z0-9 ]*$/);

export const themeSchema = object({
  fontDisplay: fontFamilySchema.optional(),
  fontBody: fontFamilySchema.optional(),
  scale: zEnum(TYPE_SCALE_KEYS).optional(),
  displayWeight: number().int().min(100).max(900).optional(),
  displayCase: zEnum(["none", "upper"]).optional(),
  displayTracking: number().min(-0.08).max(0.4).optional(),
  ink: colorSchema.optional(),
  muted: colorSchema.optional(),
  accent: colorSchema.optional(),
  accentText: colorSchema.optional(),
  ground: colorSchema.optional(),
  radius: number().min(0).max(64).optional(),
}).strip();

export type Theme = zInfer<typeof themeSchema>;

export const siteStyleSchema = object({
  style: zEnum(BACKGROUND_STYLES),
  colors: tuple([colorSchema, colorSchema, colorSchema]),
}).strip();

export type SiteStyle = zInfer<typeof siteStyleSchema>;

export type JsonParse<T> = { ok: true; value: T } | { ok: false; error: string };

function parseJsonField<T>(raw: unknown, name: string, schema: ZodType<T>): JsonParse<T> {
  if (typeof raw !== "string") return { ok: false, error: `${name} must be a string` };
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return { ok: false, error: `${name} is not valid JSON` };
  }
  const parsed = schema.safeParse(decoded);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path?.length ? issue.path.join(".") : name;
    return { ok: false, error: `${where}: ${issue?.message ?? "invalid"}` };
  }
  return { ok: true, value: parsed.data };
}

export function parseThemeJson(raw: unknown): JsonParse<Theme> {
  return parseJsonField(raw, "themeJson", themeSchema);
}

export function parseStyleJson(raw: unknown): JsonParse<SiteStyle> {
  return parseJsonField(raw, "styleJson", siteStyleSchema);
}

export const sectionSchema = object({
  id: sectionIdSchema.optional(),
  layout: zEnum(SECTION_LAYOUTS).optional(),
  kind: zEnum(SECTION_KINDS).optional(),
  reveal: zEnum(REVEALS).optional(),
  scrim: number().min(0).max(1).optional(),
  eyebrow: string().max(200).optional(),
  heading: string().max(500).optional(),
  body: string().max(5000).optional(),
  ctaLabel: string().max(200).optional(),
  ctaHref: ctaHrefSchema.optional(),
  image: imageSrcSchema.optional(),
  imageAlt: string().max(500).optional(),
  imageWidth: number().int().min(16).max(1600).optional(),
  accentColor: colorSchema.optional(),
  headingColor: colorSchema.optional(),
  bodyColor: colorSchema.optional(),
  textAlign: zEnum(["left", "center", "right"]).optional(),
  align: string().max(30).optional(),
  justify: string().max(30).optional(),
  scrollHeight: number().int().min(100).max(20_000).optional(),
  visible: boolean().optional(),
}).strip();

export const sectionsSchema = array(sectionSchema).max(MAX_SECTIONS);

/**
 * What the export route requires of a section it is handed directly.
 *
 * Stricter than "an array of anything": the route interpolates these into a page, so a
 * null element threw inside the generator and a heading of the wrong type rendered as
 * "[object Object]".
 *
 * Deliberately looser than sectionSchema on ranges and enums. The route already clamps
 * an oversized imageWidth, a scrim outside 0-1 and an unrecognised reveal, and failing a
 * whole export over a scrim of 1.05 would be worse for the user than fixing it. Types
 * here, ranges there. exportSectionsCoverSameFields in the schema tests keeps the two in
 * step.
 */
export const exportSectionSchema = object({
  id: string().optional(),
  layout: string().optional(),
  kind: string().optional(),
  reveal: string().optional(),
  scrim: number().optional(),
  eyebrow: string().optional(),
  heading: string().optional(),
  body: string().optional(),
  ctaLabel: string().optional(),
  ctaHref: string().optional(),
  image: string().optional(),
  imageAlt: string().optional(),
  imageWidth: number().optional(),
  accentColor: string().optional(),
  headingColor: string().optional(),
  bodyColor: string().optional(),
  textAlign: string().optional(),
  align: string().optional(),
  justify: string().optional(),
  scrollHeight: number().optional(),
  visible: boolean().optional(),
}).strip();

export const exportSectionsSchema = array(exportSectionSchema).max(MAX_SECTIONS);

export type Section = zInfer<typeof sectionSchema>;

export type EditorSection = Section & {
  id: string;
  eyebrow: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  accentColor: string;
  headingColor: string;
  bodyColor: string;
  textAlign: "left" | "center" | "right";
  align: string;
  justify: string;
  scrollHeight: number;
  visible: boolean;
};

export type SectionsParse =
  | { ok: true; sections: Section[] }
  | { ok: false; error: string };

export function parseSectionsJson(raw: unknown): SectionsParse {
  if (typeof raw !== "string") return { ok: false, error: "sectionsJson must be a string" };

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return { ok: false, error: "sectionsJson is not valid JSON" };
  }

  if (!Array.isArray(decoded)) return { ok: false, error: "sectionsJson must decode to an array" };

  const parsed = sectionsSchema.safeParse(decoded);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path?.length ? issue.path.join(".") : "sections";
    return { ok: false, error: `${where}: ${issue?.message ?? "invalid section"}` };
  }

  return { ok: true, sections: parsed.data };
}

export function visibleSections(sections: Section[]): Section[] {
  return sections.filter((s) => s.visible !== false);
}

/**
 * The in-page anchor for a section, by its position among the visible ones.
 *
 * Every template's call to action was an in-page link - #start, #signup, #book - to an
 * id the exported page never emitted, so the one button on a finished site did nothing.
 * Positional rather than derived from the heading: a heading can be edited or emptied,
 * and an anchor that changes when the copy changes breaks the link that points at it.
 */
export function sectionAnchor(indexAmongVisible: number): string {
  return `section-${indexAmongVisible + 1}`;
}
