#!/usr/bin/env node
/**
 * Measure a real export, and fail if it is worse than what we already ship.
 *
 * Exports a catalogue template through the running app, serves the result as a plain
 * folder the way anybody would host it, and runs Lighthouse against that. The numbers in
 * the README and in the deck come from here rather than from somebody's memory.
 *
 *   npm run build && npx next start -p 3000 &
 *   node scripts/check-export.mjs --slug weft --base http://127.0.0.1:3000
 *
 * Options:
 *   --slug <name>     catalogue template to export (default: kept)
 *   --base <url>      the running app (default: http://127.0.0.1:3000)
 *   --port <n>        port to serve the export on (default: 8910)
 *   --performance <n> minimum performance score (default: 95)
 *   --accessibility <n> minimum accessibility score (default: 100)
 *   --keep            leave the exported folder on disk
 */
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const slug = opt("slug", "kept");
const base = opt("base", "http://127.0.0.1:3000");
const port = Number(opt("port", 8910));
const minPerformance = Number(opt("performance", 95));
const minAccessibility = Number(opt("accessibility", 100));
const keep = args.includes("--keep");

const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain" };

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const res = await fetch(`${base}/api/export-site`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ template: slug, fps: 24 }),
}).catch((err) => fail(`Could not reach ${base}: ${err.message}. Is the app running?`));

if (!res.ok) fail(`Export failed with ${res.status}: ${(await res.text()).slice(0, 200)}`);
const { pages } = await res.json();
if (!Array.isArray(pages) || pages.length === 0) fail("The export returned no pages.");

const dir = mkdtempSync(join(tmpdir(), `scrollcraft-${slug}-`));
for (const page of pages) writeFileSync(join(dir, page.path), page.html);
console.log(`  exported ${slug}: ${pages.map((p) => p.path).join(", ")} (${Math.round(pages.reduce((n, p) => n + p.html.length, 0) / 1024)} KB)`);

// Served as a folder, because that is how an export is hosted and how its performance
// should be judged. No framework, no server rendering, no edge cache.
const server = createServer((req, response) => {
  const path = join(dir, decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "") || "index.html");
  if (!existsSync(path) || !path.startsWith(dir)) {
    response.writeHead(404).end("not found");
    return;
  }
  response.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
  response.end(readFileSync(path));
});
await new Promise((resolve) => server.listen(port, resolve));

const report = join(dir, "lighthouse.json");
const chrome = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// Spawned asynchronously on purpose: spawnSync blocks this process's event loop, so the
// server above cannot answer a single request while Lighthouse runs, and Chrome dies with
// "Target closed" against a server that is listening and deaf.
const stderr = [];
const code = await new Promise((resolve) => {
  const child = spawn(
    "npx",
    ["-y", "lighthouse@12", `http://127.0.0.1:${port}/`, "--quiet", "--preset=desktop", "--output=json", `--output-path=${report}`, "--chrome-flags=--headless=new --no-sandbox"],
    { env: { ...process.env, CHROME_PATH: chrome } }
  );
  child.stderr.on("data", (chunk) => stderr.push(String(chunk)));
  child.on("close", resolve);
});
server.close();

if (!existsSync(report)) fail(`Lighthouse exited ${code} without a report.\n${stderr.join("").slice(-500)}`);
const scores = Object.fromEntries(
  Object.values(JSON.parse(readFileSync(report, "utf8")).categories).map((c) => [c.title, Math.round(c.score * 100)])
);
if (!keep) rmSync(dir, { recursive: true, force: true });

for (const [title, score] of Object.entries(scores)) console.log(`  ${title.padEnd(16)} ${score}`);

const problems = [];
if (scores.Performance < minPerformance) problems.push(`performance ${scores.Performance}, under ${minPerformance}`);
if (scores.Accessibility < minAccessibility) problems.push(`accessibility ${scores.Accessibility}, under ${minAccessibility}`);
if (problems.length) fail(`${slug} is worse than what we ship: ${problems.join("; ")}`);

console.log(`\n  ${slug} clears the bar.\n`);
