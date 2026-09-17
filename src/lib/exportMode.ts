/**
 * Whether an export may ship the background as a recipe instead of JPEGs.
 *
 * Only frames the recipe drew itself can be left out and redrawn on the visitor's
 * machine. Frames sampled from an uploaded video are canvas.toDataURL() strings, so they
 * are data: URIs as well and their shape cannot tell the two apart. The editor tracks
 * where the frames came from and passes it here.
 */
export function shouldExportProcedurally(opts: {
  hasStyle: boolean;
  framesFromRecipe: boolean;
  frames: string[];
}): boolean {
  return (
    opts.hasStyle &&
    opts.framesFromRecipe &&
    opts.frames.length > 0 &&
    opts.frames.every((f) => f.startsWith("data:"))
  );
}
