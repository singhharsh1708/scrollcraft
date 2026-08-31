/**
 * The editor's save state, and what to tell the user about it.
 *
 * There is no account and no server: a document lives in this browser and nowhere else,
 * so whether the last write succeeded is the only thing standing between the user and a
 * lost afternoon. This label is the whole signal, which is why the precedence below is
 * pinned by tests rather than left to the component.
 */
export type SaveState = "idle" | "saving" | "saved" | "failed" | "partial";

/** How long the editor waits for typing to stop before writing to IndexedDB. */
export const AUTOSAVE_DEBOUNCE_MS = 1500;

export type SaveStatusLabel = "Saving…" | "Not saved" | "Background not saved" | "Unsaved changes" | "Saved";

/**
 * `dirty` outranks a past success on purpose: the moment a new edit lands, "Saved" is a
 * lie until the next write completes. A failure outranks everything, because a user who
 * is not told the write failed will close the tab.
 *
 * "partial" is the frames write failing while the document write succeeded — the text is
 * safe but the background is not. It outranks `dirty` because it reports something
 * already lost rather than something still pending, so it must not flicker away on the
 * next keystroke.
 */
export function saveStatusLabel(dirty: boolean, state: SaveState): SaveStatusLabel | null {
  if (state === "saving") return "Saving…";
  if (state === "failed") return "Not saved";
  if (state === "partial") return "Background not saved";
  if (dirty) return "Unsaved changes";
  if (state === "saved") return "Saved";
  return null;
}
