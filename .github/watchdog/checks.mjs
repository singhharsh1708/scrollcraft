// The checks the watchdog runs. Each has a stable `key` (the dedup identity — never reuse or
// rename a key without meaning to reopen a fresh issue), a human `title`, a `severity` that
// maps to a priority label, and an `area` for a subsystem label.
//
// Production checks probe the live site over HTTP and are cheap enough to run often. Code
// checks spawn the toolchain and are heavier, so the workflow runs them on a slower cadence.

import { spawnSync } from "node:child_process";

const BASE = process.env.WATCHDOG_BASE_URL || "https://scrollcraft-gilt.vercel.app";

async function get(path, { timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual", signal: ctrl.signal });
    const body = await res.text();
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function fail(evidence) { return { ok: false, evidence }; }
function pass(evidence = "") { return { ok: true, evidence }; }

export const PRODUCTION_CHECKS = [
  {
    key: "prod-health",
    title: "Production health check is not OK",
    severity: "critical",
    area: "infrastructure",
    async run() {
      const r = await get("/api/health");
      if (r.status !== 200) return fail(`GET /api/health returned ${r.status}`);
      let json;
      try { json = JSON.parse(r.body); } catch { return fail(`/api/health did not return JSON: ${r.body.slice(0, 200)}`); }
      const bad = [];
      if (json.status !== "ok") bad.push(`status="${json.status}"`);
      if (json.checks?.database && json.checks.database !== "up") bad.push(`database="${json.checks.database}"`);
      if (json.checks?.config && json.checks.config !== "ok") bad.push(`config="${json.checks.config}"`);
      return bad.length ? fail(`/api/health reports ${bad.join(", ")}`) : pass();
    },
  },
  {
    key: "prod-home",
    title: "Home page is not serving",
    severity: "critical",
    area: "infrastructure",
    async run() {
      const r = await get("/");
      return r.status === 200 ? pass() : fail(`GET / returned ${r.status}`);
    },
  },
  {
    key: "prod-templates-gallery",
    title: "Template gallery is not serving",
    severity: "high",
    area: "frontend",
    async run() {
      const r = await get("/templates");
      return r.status === 200 ? pass() : fail(`GET /templates returned ${r.status}`);
    },
  },
  {
    key: "prod-template-preview",
    title: "A template preview page is not serving",
    severity: "high",
    area: "frontend",
    async run() {
      const r = await get("/templates/meridian-watch");
      return r.status === 200 ? pass() : fail(`GET /templates/meridian-watch returned ${r.status}`);
    },
  },
  {
    key: "prod-published-route",
    title: "The published-site route errors instead of 404ing an unknown slug",
    severity: "high",
    area: "backend",
    async run() {
      // A 500 here means the /s route or its database read is broken; 404 is correct.
      const r = await get("/s/__watchdog_probe_nonexistent__");
      if (r.status === 404) return pass();
      return fail(`GET /s/<unknown> returned ${r.status} (expected 404; a 500 means the publishing route or DB is broken)`);
    },
  },
  {
    key: "prod-oauth-providers",
    title: "GitHub sign-in provider is not configured in production",
    severity: "critical",
    area: "auth",
    async run() {
      const r = await get("/api/auth/providers");
      if (r.status !== 200) return fail(`GET /api/auth/providers returned ${r.status}`);
      return r.body.includes('"github"') ? pass() : fail("provider list no longer contains github — the OAuth env vars may be unset");
    },
  },
  {
    key: "prod-sitemap",
    title: "Sitemap is missing or empty of templates",
    severity: "medium",
    area: "infrastructure",
    async run() {
      const r = await get("/sitemap.xml");
      if (r.status !== 200) return fail(`GET /sitemap.xml returned ${r.status}`);
      return r.body.includes("/templates/") ? pass() : fail("sitemap.xml contains no /templates/ URLs");
    },
  },
];

function runCmd(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 600000 });
  const out = ((r.stdout || "") + (r.stderr || "")).trim();
  return { code: r.status ?? 1, out };
}

function lastLines(s, n) {
  return s.split("\n").filter(Boolean).slice(-n).join("\n");
}

export const CODE_CHECKS = [
  {
    key: "code-typecheck",
    title: "TypeScript no longer compiles",
    severity: "high",
    area: "backend",
    run() {
      const r = runCmd("npx", ["tsc", "--noEmit"]);
      return r.code === 0 ? pass() : fail("```\n" + lastLines(r.out, 15) + "\n```");
    },
  },
  {
    key: "code-lint",
    title: "ESLint is failing",
    severity: "medium",
    area: "refactor",
    run() {
      const r = runCmd("npx", ["eslint"]);
      return r.code === 0 ? pass() : fail("```\n" + lastLines(r.out, 20) + "\n```");
    },
  },
  {
    key: "code-tests",
    title: "The test suite is failing",
    severity: "high",
    area: "testing",
    run() {
      const r = runCmd("npx", ["vitest", "run"]);
      return r.code === 0 ? pass() : fail("```\n" + lastLines(r.out, 25) + "\n```");
    },
  },
  {
    key: "code-build",
    title: "The production build is failing",
    severity: "high",
    area: "infrastructure",
    run() {
      const r = runCmd("npx", ["next", "build"]);
      return r.code === 0 ? pass() : fail("```\n" + lastLines(r.out, 25) + "\n```");
    },
  },
];
