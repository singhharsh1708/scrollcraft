# Deploying ScrollCraft

The app runs on Vercel. Everything static (templates, marketing pages) works with no
configuration, but anything that touches the database — sign-in, saving a site, the
dashboard, publishing, `/s/[slug]` — needs the environment set up and the migrations applied.

## Symptom → cause

| What you see | Cause |
| --- | --- |
| `Continue with GitHub` → `/api/auth/error?error=Configuration` ("Server error") | No reachable database: the OAuth callback cannot write the user/session. |
| `/api/health` shows `database: down`, `config: invalid` | `DATABASE_URL` is not set in the Vercel project. |
| `/s/<slug>` returns 500 even with a database | The publishing migration has not been applied. |
| First-ever GitHub sign-up fails after a database is connected | The `User.emailVerified` migration has not been applied. |

## 1. Set environment variables (Vercel → Project → Settings → Environment Variables)

Required — the app cannot serve authenticated requests without these:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | A Postgres connection string (Neon, Supabase, or Vercel Postgres). |
| `AUTH_SECRET` | A strong random string: `openssl rand -base64 32`. |
| `AUTH_URL` | `https://<your-domain>` (e.g. `https://scrollcraft-gilt.vercel.app`). |

OAuth (set the providers you want; the sign-in page shows only configured ones):

| Variable | Value |
| --- | --- |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | From a GitHub OAuth app whose callback URL is `https://<your-domain>/api/auth/callback/github`. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | From a Google OAuth client with the matching `/api/auth/callback/google` redirect URI. |

Optional: `BLOB_READ_WRITE_TOKEN` (video-frame storage), `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN` (multi-instance rate limiting), `RAZORPAY_*` / `LEMONSQUEEZY_*`
(payments), `NEXT_PUBLIC_SENTRY_DSN` (error monitoring). See `.env.example` for the full list.

Redeploy after setting these.

## 2. Apply database migrations

The Vercel build has no database access, so migrations run separately. Two ways:

- **Automatic (CI):** add a `DATABASE_URL` repository secret (GitHub → Settings → Secrets and
  variables → Actions) pointing at the production database. The `Apply database migrations`
  workflow (`.github/workflows/migrate.yml`) then runs `prisma migrate deploy` on every push
  to `main` that changes `prisma/migrations/`, and can be run on demand from the Actions tab.
- **Manual (once):** `DATABASE_URL='<production url>' npm run deploy`

Apply migrations before the code that depends on a new column serves traffic.

## 3. Verify

```
curl https://<your-domain>/api/health
```

Healthy output is `"status":"ok"` with `database: up`. Then `Continue with GitHub` should
complete, and publishing a site should give a working `/s/<slug>` link.
