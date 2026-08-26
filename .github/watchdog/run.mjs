// Runs the requested check set and prints a results array to stdout.
// Usage: node run.mjs <production|code|all>
import { PRODUCTION_CHECKS, CODE_CHECKS } from "./checks.mjs";

const mode = process.argv[2] || "all";
const sets = { production: PRODUCTION_CHECKS, code: CODE_CHECKS, all: [...PRODUCTION_CHECKS, ...CODE_CHECKS] };
const checks = sets[mode];
if (!checks) { console.error(`unknown mode "${mode}"`); process.exit(2); }

const results = [];
for (const c of checks) {
  try {
    const r = await c.run();
    results.push({ key: c.key, title: c.title, severity: c.severity, area: c.area, ok: r.ok, evidence: r.evidence || "" });
  } catch (e) {
    results.push({ key: c.key, title: c.title, severity: c.severity, area: c.area, ok: false, evidence: `check threw: ${e.message}` });
  }
}
process.stdout.write(JSON.stringify(results));
