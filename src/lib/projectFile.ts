import { string, number, boolean, object, literal, type infer as zInfer } from "zod";
import { sectionsSchema, type Section } from "@/lib/siteSchema";

export const PROJECT_FORMAT = "scrollcraft.project";
export const PROJECT_VERSION = 1;

/** Room for a long site with custom CSS, and far short of what a stray file could cost. */
const MAX_FILE_BYTES = 5_000_000;

const documentSchema = object({
  name: string().max(200),
  description: string().max(1000).optional(),
  sections: sectionsSchema,
  themeJson: string().max(20_000).nullable().optional(),
  styleJson: string().max(5_000).nullable().optional(),
  customHead: string().max(20_000).optional(),
  customCss: string().max(100_000).optional(),
  fps: number().int().min(1).max(60).optional(),
  framesFromRecipe: boolean().optional(),
}).strip();

const projectFileSchema = object({
  format: literal(PROJECT_FORMAT),
  version: number().int().min(1),
  exportedAt: string().max(40).optional(),
  document: documentSchema,
}).strip();

export type ProjectDocument = Omit<zInfer<typeof documentSchema>, "sections"> & { sections: Section[] };
export type ProjectFile = { format: string; version: number; exportedAt?: string; document: ProjectDocument };

export type ProjectParse = { ok: true; value: ProjectFile } | { ok: false; error: string };

export function buildProjectFile(doc: ProjectDocument): string {
  return JSON.stringify(
    { format: PROJECT_FORMAT, version: PROJECT_VERSION, exportedAt: new Date().toISOString(), document: doc },
    null,
    2
  );
}

export function parseProjectFile(text: string): ProjectParse {
  if (text.length > MAX_FILE_BYTES) {
    return { ok: false, error: "That file is too large to be a ScrollCraft project." };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    return { ok: false, error: "That is not a ScrollCraft project file." };
  }

  const shape = decoded as { format?: unknown; version?: unknown };
  if (shape?.format !== PROJECT_FORMAT) {
    return { ok: false, error: "That is not a ScrollCraft project file." };
  }
  if (typeof shape.version === "number" && shape.version > PROJECT_VERSION) {
    return { ok: false, error: "That file was saved by a newer version of ScrollCraft. Update and open it again." };
  }

  const parsed = projectFileSchema.safeParse(decoded);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path?.length ? issue.path.join(".").replace(/^document\./, "") : "file";
    return { ok: false, error: `This project file is damaged: ${where} ${issue?.message ?? "is invalid"}.` };
  }

  return { ok: true, value: parsed.data as ProjectFile };
}

export function projectFileName(siteName: string): string {
  const slug = siteName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "site"}.scrollcraft.json`;
}

/**
 * Whether the background in this document comes back on another machine.
 *
 * A drawn background is a recipe, so it redraws anywhere. Frames pulled from somebody's
 * own video are pixels held in this browser, and are far too large for a file meant to be
 * mailed around, so the editor warns rather than dropping them quietly.
 */
export function backgroundTravels(doc: ProjectDocument): boolean {
  return doc.framesFromRecipe === true && Boolean(doc.styleJson);
}
