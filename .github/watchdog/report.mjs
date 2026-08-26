// The rules engine. It reconciles check results against the repo's open issues so the
// watchdog is useful rather than noisy. The rules, in order:
//
//   1. Identity: every check has a stable key. An issue it owns carries a hidden marker
//      `<!-- watchdog:KEY -->`. That marker, not the title, is how a prior issue is found.
//   2. Open once: a failing check with no open marked issue opens exactly one. A failing
//      check that already has an open marked issue never opens a second.
//   3. Quiet updates: if the issue exists and the failure evidence changed, add one comment;
//      if it is unchanged, do nothing at all (no comment, no reopen).
//   4. Recover and close: a passing check whose marked issue is still open gets a "recovered"
//      comment and is closed. A human who reopened it is respected — see rule 6.
//   5. Allowlist: keys listed in allow.json are skipped entirely (never opened or closed),
//      for failures the maintainer has accepted (e.g. transitive audit advisories).
//   6. Human edits win: the watchdog only ever touches issues that still carry its marker and
//      the `watchdog` label. Remove either and it leaves the issue alone forever.
//   7. Safety cap: at most MAX_NEW new issues per run, so a broad outage cannot flood the
//      tracker. The rest are logged and reported next run.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAX_NEW = 5;
const DRY = process.env.WATCHDOG_DRY_RUN === "1" || process.argv.includes("--dry-run");
const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY || "singhharsh1708/scrollcraft";

const SEVERITY_LABEL = {
  critical: "priority: critical",
  high: "priority: high",
  medium: "priority: medium",
  low: "priority: low",
};

function marker(key) { return `<!-- watchdog:${key} -->`; }

function loadAllowlist() {
  try {
    const raw = fs.readFileSync(path.join(HERE, "allow.json"), "utf8");
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed.allow) ? parsed.allow : []);
  } catch {
    return new Set();
  }
}

async function gh(method, apiPath, body) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${apiPath} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// All open watchdog issues, indexed by the key in their marker.
async function openWatchdogIssues() {
  const byKey = new Map();
  for (let page = 1; page <= 10; page++) {
    const issues = await gh("GET", `/issues?state=open&labels=watchdog&per_page=100&page=${page}`);
    if (!issues.length) break;
    for (const issue of issues) {
      if (issue.pull_request) continue;
      const m = /<!-- watchdog:([a-z0-9-]+) -->/.exec(issue.body || "");
      if (m) byKey.set(m[1], issue);
    }
    if (issues.length < 100) break;
  }
  return byKey;
}

function issueBody(check, evidence) {
  return [
    marker(check.key),
    "",
    `**Automated watchdog report** — the \`${check.key}\` check is failing.`,
    "",
    "## What broke",
    check.title + ".",
    "",
    "## Evidence",
    evidence || "_(no detail captured)_",
    "",
    "## What this is",
    "Opened automatically by the watchdog workflow (`.github/workflows/watchdog.yml`). It will",
    "close this issue on its own once the check passes again. Remove the `watchdog` label to",
    "have it stop managing this issue.",
  ].join("\n");
}

async function reconcile(results) {
  const allow = loadAllowlist();
  const open = await openWatchdogIssues();
  const actions = [];
  let opened = 0;

  for (const r of results) {
    if (allow.has(r.key)) { actions.push({ key: r.key, action: "skipped-allowlist" }); continue; }
    const existing = open.get(r.key);

    if (!r.ok) {
      const body = issueBody(r, r.evidence);
      if (existing) {
        // Rule 3: comment only when the evidence changed.
        const prior = existing.body || "";
        const changed = prior.trim() !== body.trim();
        if (changed) {
          if (!DRY) await gh("POST", `/issues/${existing.number}/comments`, {
            body: `Still failing, with new detail:\n\n${r.evidence || "_(no detail)_"}`,
          });
          if (!DRY) await gh("PATCH", `/issues/${existing.number}`, { body });
          actions.push({ key: r.key, action: "updated", issue: existing.number });
        } else {
          actions.push({ key: r.key, action: "unchanged", issue: existing.number });
        }
      } else {
        if (opened >= MAX_NEW) { actions.push({ key: r.key, action: "capped" }); continue; }
        opened++;
        const labels = ["watchdog", SEVERITY_LABEL[r.severity] || "priority: medium"];
        if (r.area) labels.push(r.area);
        if (!DRY) {
          const created = await gh("POST", "/issues", {
            title: `watchdog: ${r.title}`,
            body: issueBody(r, r.evidence),
            labels,
          });
          actions.push({ key: r.key, action: "opened", issue: created.number });
        } else {
          actions.push({ key: r.key, action: "would-open", labels });
        }
      }
    } else if (existing) {
      // Rule 4: recovered → close.
      if (!DRY) {
        await gh("POST", `/issues/${existing.number}/comments`, {
          body: "Recovered — the watchdog check passes again. Closing.",
        });
        await gh("PATCH", `/issues/${existing.number}`, { state: "closed", state_reason: "completed" });
      }
      actions.push({ key: r.key, action: "closed", issue: existing.number });
    }
  }
  return actions;
}

async function main() {
  const input = fs.readFileSync(process.env.WATCHDOG_RESULTS || "/dev/stdin", "utf8");
  const results = JSON.parse(input);
  if (!TOKEN && !DRY) {
    console.error("No GITHUB_TOKEN and not a dry run — refusing to proceed.");
    process.exit(1);
  }
  const actions = await reconcile(results);
  const failing = results.filter((r) => !r.ok).map((r) => r.key);
  console.log(JSON.stringify({ dryRun: DRY, failing, actions }, null, 2));
  // A run where something is broken still exits 0: opening the issue is success, not failure.
}

// Only run when executed directly, so the reconcile helpers can be imported for testing.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

export { reconcile, openWatchdogIssues, marker };
