# Watchdog

An automated diagnostic that watches the live site and the codebase and files GitHub issues
when something breaks — under strict rules so it stays useful instead of noisy.

## What it checks

**Production** (every 6 hours, over HTTP against the live deployment):

| Check | Fails when |
| --- | --- |
| `prod-health` | `/api/health` is not `status: ok` (configuration invalid). |
| `prod-home` | `/` does not return 200. |
| `prod-templates-gallery` | `/templates` does not return 200. |
| `prod-template-preview` | a template page does not return 200. |
| `prod-sitemap` | `/sitemap.xml` is missing or has no template URLs. |

**Code** (daily, and on every push to `main` that touches `src/`, `prisma/`, or the watchdog):

| Check | Fails when |
| --- | --- |
| `code-typecheck` | `tsc --noEmit` errors. |
| `code-lint` | `eslint` errors. |
| `code-tests` | `vitest run` fails. |
| `code-build` | `next build` fails. |

## The rules

1. **One key, one issue.** Each check has a stable key. An issue it owns carries a hidden
   marker `<!-- watchdog:KEY -->`; that marker, not the title, is its identity.
2. **Never duplicates.** A failing check with an open marked issue never opens a second one.
3. **Quiet updates.** If the failure detail changed, it adds one comment; if nothing changed,
   it does nothing at all.
4. **Recovers and closes.** When a failing check passes again, its issue is commented and
   closed automatically.
5. **Allowlist.** Keys in `.github/watchdog/allow.json` are ignored — for failures you have
   accepted (e.g. a transitive advisory awaiting an upstream bump).
6. **Human edits win.** It only touches issues that still carry its marker and the `watchdog`
   label. Remove either and it never touches that issue again.
7. **Safety cap.** At most five new issues per run, so a broad outage cannot flood the tracker.

## Running it by hand

Actions tab → **Watchdog** → Run workflow → pick `production`, `code`, or `all`.

Locally, without touching the tracker:

```bash
node .github/watchdog/run.mjs production | WATCHDOG_DRY_RUN=1 node .github/watchdog/report.mjs
```

`WATCHDOG_DRY_RUN=1` prints what it *would* do and writes nothing.

## Requirements

Runs on the workflow's built-in `GITHUB_TOKEN` (needs `issues: write`, already granted in the
workflow). No extra secret. Set the repo variable `WATCHDOG_BASE_URL` if the production URL is
not `https://scrollcraft-gilt.vercel.app`.
