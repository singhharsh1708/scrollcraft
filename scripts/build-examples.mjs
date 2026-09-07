#!/usr/bin/env node
/**
 * Build the example sites into public/examples/<slug>/.
 *
 * The examples are the real deliverable, not a mock-up of it: each one is produced by the
 * same scripts a reader would run, and what gets served is the exported bundle itself.
 *
 * Only the specs are committed. A frame set is 2.4 MiB per site and would be stale the
 * moment the exporter changed, so the bundles are generated here and git-ignored. The
 * whole run takes a few seconds, which is cheaper than carrying 7 MiB of JPEGs in the
 * repository and having to remember to regenerate them.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scripts = join(root, "plugins/scrollcraft/skills/scrollcraft/scripts");
const manifest = JSON.parse(readFileSync(join(root, "examples/manifest.json"), "utf8"));
const outRoot = join(root, "public/examples");

const run = (script, args) =>
  execFileSync(process.execPath, [join(scripts, script), ...args], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });

const dirBytes = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).reduce((sum, f) => sum + statSync(join(dir, f)).size, 0)
    : 0;

mkdirSync(outRoot, { recursive: true });

/** What each bundle actually weighs, so the gallery can quote it instead of guessing. */
const measured = [];

for (const site of manifest) {
  const src = join(root, "examples", site.slug);
  const spec = join(src, "scrollcraft.json");
  if (!existsSync(spec)) throw new Error(`${site.slug}: no scrollcraft.json`);

  const frames = join(src, "frames");
  const framesMobile = join(src, "frames-mobile");
  const dist = join(outRoot, site.slug);

  rmSync(frames, { recursive: true, force: true });
  rmSync(framesMobile, { recursive: true, force: true });
  rmSync(dist, { recursive: true, force: true });

  run("frames-from-style.mjs", [
    "--style", site.style,
    "--count", String(site.count),
    "--width", String(site.width),
    "--mobile-width", String(site.mobileWidth),
    "--out", frames,
    "--mobile-out", framesMobile,
  ]);

  run("build-site.mjs", ["--spec", spec, "--out", dist]);

  // The frame sets live in the bundle now; leaving copies beside the spec would only
  // confuse the next person to open the directory.
  rmSync(frames, { recursive: true, force: true });
  rmSync(framesMobile, { recursive: true, force: true });

  const htmlBytes = statSync(join(dist, "index.html")).size;
  const frameFiles = readdirSync(join(dist, "frames")).filter((f) => f.endsWith(".jpg")).length;
  const totalBytes = htmlBytes + dirBytes(join(dist, "frames")) + dirBytes(join(dist, "frames-mobile"));
  const sections = JSON.parse(readFileSync(spec, "utf8")).sections;

  measured.push({
    slug: site.slug,
    htmlBytes,
    totalBytes,
    frameCount: frameFiles,
    sectionCount: sections.filter((s) => s.visible !== false).length,
    scrollHeight:
      sections.filter((s) => s.visible !== false).reduce((n, s) => n + (s.scrollHeight ?? 1000), 0) + 1000,
  });

  console.log(
    `examples: ${site.slug.padEnd(12)} ${(htmlBytes / 1024).toFixed(0).padStart(3)} KiB html` +
      `  ${(totalBytes / 1024 / 1024).toFixed(2)} MiB total  ${frameFiles} frames`
  );
}

writeFileSync(join(outRoot, "built.json"), JSON.stringify(measured, null, 2) + "\n");
