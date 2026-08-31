# Contributing to ScrollCraft

Thanks for your interest in improving ScrollCraft! 🎉 This guide covers everything you
need to get set up, make changes, and get them merged.

## Code of Conduct

Be respectful, constructive, and inclusive. We want ScrollCraft to be a welcoming project
for contributors of all experience levels. Harassment or dismissive behaviour of any kind
isn't tolerated.

## Ways to contribute

- 🐛 **Report bugs** — open an [issue](https://github.com/singhharsh1708/scrollcraft/issues) with steps to reproduce.
- 💡 **Suggest features** — open an issue describing the problem you're solving.
- 📝 **Improve docs** — typos, clarifications, and examples are all welcome.
- 🔧 **Fix issues** — look for issues labelled [`good first issue`](https://github.com/singhharsh1708/scrollcraft/labels/good%20first%20issue) or `help wanted`.

## Development setup

> Requires Node.js 20+. That is the whole list.

```bash
# Fork the repo, then:
git clone https://github.com/<your-username>/scrollcraft.git
cd scrollcraft
npm install
npm run dev
```

There is no database to provision, no account to create and no key to obtain. Every
environment variable is optional, so the app runs with no `.env` at all. If you want
error reporting or shared rate limiting while developing, `.env.example` lists what
those need.

## Workflow

1. **Find or open an issue.** Comment on it so we can assign it to you and avoid duplicate work.
2. **Create a branch** off `main`:
   ```bash
   git checkout -b feat/short-description     # or fix/…, docs/…, chore/…
   ```
3. **Make your changes** following the standards below.
4. **Verify locally** — all of these must pass:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm test
   npm run build
   ```
5. **Commit** using clear, present-tense messages (see below).
6. **Push** and open a Pull Request against `main`. Link the issue (`Closes #123`).

## Branch naming

| Prefix | Use for |
|--------|---------|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `refactor/` | Code changes that neither fix a bug nor add a feature |
| `chore/` | Tooling, deps, config |
| `test/` | Adding or fixing tests |

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org):

```
feat: autosave the editor instead of relying on the Save button
fix: stop the toasts from following the OS instead of the app
docs: fix contributor setup, which still asked for a database
```

## Coding standards

- **TypeScript** — no `any` unless genuinely unavoidable; prefer precise types.
- **Match the surrounding code** — naming, structure, and comment density should look like the file you're editing.
- **Server vs client** — files importing `server-only` must never be imported into client components. Keep secrets server-side.
- **Validate input** — all API route handlers validate request bodies with [Zod](https://zod.dev).
- **Rate limit** — public API routes go through `rateLimit()` from `src/lib/rateLimit.ts`.
- **Log, don't `console.log`** — use the structured `logger` from `src/lib/logger.ts` in API/server code.
- **Lint clean** — don't introduce new ESLint errors. Run `npm run lint` before pushing.

## Where state lives

There is no server-side state to change. A visitor's work is held in their own browser
(IndexedDB, via `src/lib/frameStorage.ts`) until they export it, and the two API routes
hold nothing between requests.

If a change would need somewhere to persist data, say so in the issue before building
it — adding a database back is a product decision, not an implementation detail.

## Tests

- Tests live in `src/__tests__/` and run with [Vitest](https://vitest.dev).
- Add tests for new logic, especially anything that touches the exporter, the scroll engine, or what the site claims about itself
  (signature verification, rate limiting, idempotency).
- Run the suite with `npm test`.

## Pull request checklist

Before requesting review, confirm:

- [ ] The PR is focused on a single concern.
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm test`, and `npm run build` all pass.
- [ ] New behaviour is covered by tests where practical.
- [ ] Docs / `.env.example` updated if you changed config or env vars.
- [ ] The PR description explains **what** changed and **why**, and links the issue.

## Security

Please **do not** open public issues for security vulnerabilities. Instead, report them
privately — see [SECURITY.md](SECURITY.md).

---

Thanks again for contributing! Every fix, feature, and typo correction makes ScrollCraft better. 💜
