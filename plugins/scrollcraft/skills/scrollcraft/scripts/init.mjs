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

const GRAMMARS = {
  reveal: [
    { kind: "statement", layout: "center", reveal: "mask", scrollHeight: 1400 },
    { kind: "spacer", scrollHeight: 700 },
    { layout: "left", reveal: "stagger", scrollHeight: 1500 },
    { kind: "statement", layout: "lower-third", reveal: "scale", scrollHeight: 1800 },
    { layout: "right", reveal: "fade", scrollHeight: 1200 },
    { layout: "center", reveal: "rise", scrollHeight: 1000 },
  ],
  catalogue: [
    { kind: "statement", layout: "center", reveal: "fade", scrollHeight: 1200 },
    { layout: "left", reveal: "rise", scrollHeight: 1300 },
    { layout: "right", reveal: "rise", scrollHeight: 1300 },
    { layout: "left", reveal: "rise", scrollHeight: 1300 },
    { layout: "center", reveal: "scale", scrollHeight: 1000 },
  ],
  manifesto: [
    { kind: "statement", layout: "lower-third", reveal: "mask", scrollHeight: 1600 },
    { layout: "lower-third", reveal: "stagger", scrollHeight: 1500 },
    { kind: "spacer", scrollHeight: 900 },
    { layout: "lower-third", reveal: "stagger", scrollHeight: 1500 },
    { kind: "statement", layout: "center", reveal: "scale", scrollHeight: 1400 },
  ],
  dossier: [
    { layout: "upper-third", reveal: "fade", scrollHeight: 900 },
    { layout: "upper-third", reveal: "fade", scrollHeight: 900 },
    { layout: "upper-third", reveal: "fade", scrollHeight: 900 },
    { layout: "center", reveal: "rise", scrollHeight: 900 },
  ],
  descent: [
    { kind: "statement", layout: "center", reveal: "scale", scrollHeight: 2000 },
    { layout: "center", reveal: "fade", scrollHeight: 1400 },
    { layout: "left", reveal: "fade", scrollHeight: 1200 },
    { kind: "spacer", scrollHeight: 800 },
    { layout: "lower-third", reveal: "fade", scrollHeight: 900 },
  ],
  single: [
    { kind: "statement", layout: "center", reveal: "mask", scrollHeight: 2600 },
    { layout: "center", reveal: "fade", scrollHeight: 1000 },
  ],
};

const THEMES = {
  aurora: { fontDisplay: "Archivo", fontBody: "IBM Plex Sans", scale: "editorial", displayWeight: 800, ink: "#eef4f6", muted: "rgba(238,244,246,0.72)", accent: "#396f78", accentText: "#a0dce5", radius: 6 },
  nebula: { fontDisplay: "Fraunces", fontBody: "Karla", scale: "poster", displayWeight: 700, displayTracking: -0.03, ink: "#f2ecfb", muted: "rgba(242,236,251,0.72)", accent: "#7e54a7", accentText: "#e1c9f8", radius: 14 },
  tide: { fontDisplay: "Space Grotesk", fontBody: "Inter", scale: "editorial", displayWeight: 700, ink: "#e8f4f5", muted: "rgba(232,244,245,0.7)", accent: "#2a7179", accentText: "#99dde5", radius: 4 },
  ember: { fontDisplay: "Archivo", fontBody: "IBM Plex Sans", scale: "poster", displayWeight: 800, displayCase: "upper", displayTracking: -0.02, ink: "#f6efe8", muted: "rgba(246,239,232,0.7)", accent: "#a94b0d", accentText: "#f8c9aa", radius: 2 },
  dusk: { fontDisplay: "Playfair Display", fontBody: "Lato", scale: "editorial", displayWeight: 700, displayTracking: -0.02, ink: "#f7eef1", muted: "rgba(247,238,241,0.72)", accent: "#915563", accentText: "#f0c8d1", radius: 18 },
  monolith: { fontDisplay: "Oswald", fontBody: "Roboto", scale: "compact", displayWeight: 600, displayCase: "upper", displayTracking: 0.02, ink: "#e9edf1", muted: "rgba(233,237,241,0.68)", accent: "#5e6871", accentText: "#c9d3dc", radius: 0 },
};

const COPY = [
  { eyebrow: "Introducing", body: "Replace this copy. One idea per section, a heading and at most two lines." },
  { body: "This section owns more of the track, so the background travels further while it is on screen." },
  { body: "Each section sets its own layout and reveal, so consecutive screens do not share a skeleton." },
  { body: "Say the one thing that matters here, then stop." },
  { body: "A quiet stretch before the close reads as confidence." },
];

function starterSpec(name, style, grammar) {
  const shape = GRAMMARS[grammar] || GRAMMARS.reveal;
  let copyIndex = 0;
  const sections = shape.map((slot, i) => {
    if (slot.kind === "spacer") return { ...slot };
    const copy = COPY[copyIndex++ % COPY.length];
    const last = i === shape.length - 1;
    return {
      ...slot,
      ...(i === 0 ? { eyebrow: copy.eyebrow } : {}),
      heading: i === 0 ? name : `Section ${i + 1}`,
      ...(slot.kind === "statement" ? {} : { body: copy.body }),
      ...(last ? { ctaLabel: "Get started", ctaHref: "https://example.com" } : {}),
    };
  });

  return {
    name,
    description: `${name} — a scroll-driven story.`,
    canvasAlt: `Abstract ${style} background that shifts as the page scrolls`,
    framesMobile: "frames-mobile",
    theme: THEMES[style] || THEMES.aurora,
    sections,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      "Usage: init.mjs [--name \"My Site\"] [--style aurora] [--grammar reveal] [--dir .]\n" +
      "                [--count 180] [--width 1920] [--force] [--no-build]\n\n" +
      `Grammars: ${Object.keys(GRAMMARS).join(", ")}\n` +
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
  const grammar = typeof args.grammar === "string" ? args.grammar : "reveal";
  if (!GRAMMARS[grammar]) {
    fail(`unknown grammar "${grammar}" (allowed: ${Object.keys(GRAMMARS).join(", ")})`);
  }

  fs.mkdirSync(dir, { recursive: true });
  const specPath = path.join(dir, "scrollcraft.json");

  if (fs.existsSync(specPath) && !args.force) {
    fail(`${specPath} already exists. Pass --force to overwrite it, or --dir to scaffold elsewhere.`);
  }

  fs.writeFileSync(specPath, JSON.stringify(starterSpec(name, style, grammar), null, 2) + "\n");
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
