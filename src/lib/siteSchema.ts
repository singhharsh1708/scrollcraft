import { z } from "zod";

export const SECTION_LAYOUTS = ["center", "left", "right", "lower-third", "upper-third"] as const;
export type SectionLayout = (typeof SECTION_LAYOUTS)[number];

export const SECTION_KINDS = ["text", "statement", "spacer"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const REVEALS = ["rise", "fade", "mask", "stagger", "scale", "none"] as const;
export type Reveal = (typeof REVEALS)[number];

export const MAX_SECTIONS = 100;

export const sectionIdSchema = z.string().min(1).max(100);

export const colorSchema = z.string().max(50)
  .regex(/^(?:#[0-9a-fA-F]{3,8}|(?:rgb|hsl)a?\([\d\s.,%/]+\)|[a-zA-Z]{3,20})$/);

export const ctaHrefSchema = z.string().max(2000)
  .refine((v) => v === "" || /^(?:#|\/|\.{1,2}\/|https?:\/\/|mailto:|tel:)/i.test(v));

export const imageSrcSchema = z.string().max(2000)
  .refine((v) => v === "" || /^(?:https?:\/\/|\/|\.{1,2}\/|assets\/)/i.test(v), {
    message: "image must be an http(s) URL or a relative path",
  });

export const TYPE_SCALE_KEYS = ["compact", "editorial", "poster"] as const;

export const BACKGROUND_STYLES = ["gradient", "geometric", "particles", "wave"] as const;

// The family name is interpolated into a Google Fonts stylesheet URL, so the charset is
// constrained rather than escaped.
export const fontFamilySchema = z.string().min(1).max(60).regex(/^[A-Za-z0-9][A-Za-z0-9 ]*$/);

export const themeSchema = z.object({
  fontDisplay: fontFamilySchema.optional(),
  fontBody: fontFamilySchema.optional(),
  scale: z.enum(TYPE_SCALE_KEYS).optional(),
  displayWeight: z.number().int().min(100).max(900).optional(),
  displayCase: z.enum(["none", "upper"]).optional(),
  displayTracking: z.number().min(-0.08).max(0.4).optional(),
  ink: colorSchema.optional(),
  muted: colorSchema.optional(),
  accent: colorSchema.optional(),
  accentText: colorSchema.optional(),
  ground: colorSchema.optional(),
  radius: z.number().min(0).max(64).optional(),
}).strip();

export type Theme = z.infer<typeof themeSchema>;

export const siteStyleSchema = z.object({
  style: z.enum(BACKGROUND_STYLES),
  colors: z.tuple([colorSchema, colorSchema, colorSchema]),
}).strip();

export type SiteStyle = z.infer<typeof siteStyleSchema>;

export type JsonParse<T> = { ok: true; value: T } | { ok: false; error: string };

function parseJsonField<T>(raw: unknown, name: string, schema: z.ZodType<T>): JsonParse<T> {
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

export const sectionSchema = z.object({
  id: sectionIdSchema.optional(),
  layout: z.enum(SECTION_LAYOUTS).optional(),
  kind: z.enum(SECTION_KINDS).optional(),
  reveal: z.enum(REVEALS).optional(),
  scrim: z.number().min(0).max(1).optional(),
  eyebrow: z.string().max(200).optional(),
  heading: z.string().max(500).optional(),
  body: z.string().max(5000).optional(),
  ctaLabel: z.string().max(200).optional(),
  ctaHref: ctaHrefSchema.optional(),
  image: imageSrcSchema.optional(),
  imageAlt: z.string().max(500).optional(),
  imageWidth: z.number().int().min(16).max(1600).optional(),
  accentColor: colorSchema.optional(),
  headingColor: colorSchema.optional(),
  bodyColor: colorSchema.optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  align: z.string().max(30).optional(),
  justify: z.string().max(30).optional(),
  scrollHeight: z.number().int().min(100).max(20_000).optional(),
  visible: z.boolean().optional(),
}).strip();

export const sectionsSchema = z.array(sectionSchema).max(MAX_SECTIONS);

export type Section = z.infer<typeof sectionSchema>;

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
