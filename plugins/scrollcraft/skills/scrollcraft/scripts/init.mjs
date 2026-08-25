#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function fail(msg) {
  process.stderr.write("init: " + msg + "\n");
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

function run(script, args) {
  const r = spawnSync(process.execPath, [path.join(HERE, script), ...args], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  if (r.error) fail(`could not run ${script}: ${r.error.message}`);
  if (r.status !== 0) fail(`${script} failed with status ${r.status}`);
}

function starterSpec(name, style) {
  return {
    name,
    description: `${name} — a scroll-driven story.`,
    canvasAlt: `Abstract ${style} background that shifts as the page scrolls`,
    framesMobile: "frames-mobile",
    sections: [
      {
        layout: "center",
        eyebrow: "Introducing",
        heading: name,
        body: "Replace this copy. One idea per section, a heading and at most two lines — the reader is scrolling, not studying.",
        scrollHeight: 1400,
      },
      {
        layout: "left",
        heading: "Give the good part room",
        body: "This section owns more of the scroll track than the others, so the background moves further while it is on screen.",
        scrollHeight: 2000,
      },
      {
        layout: "lower-third",
        heading: "Change shape as you go",
        body: "Each section sets its own layout, so consecutive screens do not share a skeleton.",
        scrollHeight: 1200,
      },
      {
        layout: "center",
        heading: "Then ask for something",
        ctaLabel: "Get started",
        ctaHref: "https://example.com",
        scrollHeight: 1000,
      },
    ],
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      "Usage: init.mjs [--name \"My Site\"] [--style aurora] [--dir .] [--count 180]\n" +
      "                [--width 1920] [--force] [--no-build]\n\n" +
      "Scaffolds scrollcraft.json, generates a frame set, and builds dist/ so there is\n" +
      "something real on screen before you write any copy.\n"
    );
    return;
  }

  const dir = path.resolve(typeof args.dir === "string" ? args.dir : ".");
  const name = typeof args.name === "string" ? args.name : "Untitled";
  const style = typeof args.style === "string" ? args.style : "aurora";
  const count = typeof args.count === "string" ? args.count : "180";
  const width = typeof args.width === "string" ? args.width : "1920";

  fs.mkdirSync(dir, { recursive: true });
  const specPath = path.join(dir, "scrollcraft.json");

  if (fs.existsSync(specPath) && !args.force) {
    fail(`${specPath} already exists. Pass --force to overwrite it, or --dir to scaffold elsewhere.`);
  }

  fs.writeFileSync(specPath, JSON.stringify(starterSpec(name, style), null, 2) + "\n");
  process.stdout.write(`wrote ${path.relative(process.cwd(), specPath) || "scrollcraft.json"}\n`);

  run("frames-from-style.mjs", [
    "--style", style, "--count", count, "--width", width,
    "--out", path.join(dir, "frames"),
    "--mobile-out", path.join(dir, "frames-mobile"),
    "--mobile-width", "828",
  ]);

  if (!args["no-build"]) {
    run("build-site.mjs", ["--spec", specPath, "--out", path.join(dir, "dist")]);
  }

  const rel = path.relative(process.cwd(), dir) || ".";
  const shortest = (p) => {
    const r = path.relative(process.cwd(), p);
    return !r || r.startsWith("..") ? p : r;
  };
  process.stdout.write(
    "\nNext:\n" +
    `  1. open ${path.join(rel, "scrollcraft.json")} and write your own sections\n` +
    `  2. node ${shortest(path.join(HERE, "build-site.mjs"))} --spec ${path.join(rel, "scrollcraft.json")} --out ${path.join(rel, "dist")}\n` +
    `  3. node ${shortest(path.join(HERE, "serve.mjs"))} --dir ${path.join(rel, "dist")}\n` +
    `\nTo try another look: ${shortest(path.join(HERE, "frames-from-style.mjs"))} --list\n`
  );
}

main();
