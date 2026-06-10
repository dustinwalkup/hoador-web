# Plan 001: Add CLAUDE.md, rewrite README for the real stack, fix self-recursive audit scripts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5c32982..HEAD -- package.json README.md CLAUDE.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2 (but execute first — it lowers the cost of every later plan)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `5c32982`, 2026-06-10

## Why this matters

This repo has no CLAUDE.md/AGENTS.md, its README is still create-next-app boilerplate (suggests npm/yarn/pnpm; the repo is bun-only with a `bun.lockb`), and `package.json` defines `"audit": "bun audit"` — which makes `bun run audit` (and `bun audit`, since bun prefers package scripts) recurse into itself infinitely until the shell dies with EAGAIN (verified on 2026-06-10). Seven more plans in this directory will be executed by agents; a correct CLAUDE.md is the cheapest way to make all of them (and every future session) faster and more convention-conformant.

## Current state

- `package.json:25-26` — the broken scripts:
  ```json
  "audit": "bun audit",
  "audit:fix": "bun audit --fix",
  ```
- `README.md:1-28` — create-next-app boilerplate ("This is a [Next.js](https://nextjs.org) project bootstrapped with…", `npm run dev` / `yarn dev` / `pnpm dev`). Lines 30-77 contain real, keep-worthy sections: "PWA push notifications", "Auth E2E tests", "Playwright (rental agreement PDF generation)", "Syncing branches after merging develop into main", "Deploy on Vercel".
- No `CLAUDE.md` or `AGENTS.md` exists at the repo root.
- Real stack (verified): Next.js 16 App Router, React 19, TypeScript 6, Drizzle ORM on Neon Postgres, better-auth, Stripe + Stripe Connect, TanStack React Query, Tailwind 4, Sentry, Resend, web-push, OpenAI. Package manager: bun (engines node >=24). Tests: vitest (happy-dom) + Playwright e2e (docker compose Postgres).
- Architecture rules live in `docs/ARCHITECTURE_V2.md` (note: that doc currently ends abruptly at a code example — do not treat its truncation as license to invent rules).
- Cron infrastructure: GitHub Actions (`.github/workflows/cron-jobs.yml`) calls `/api/cron/*` routes with a `CRON_SECRET` bearer token. `vercel.json` is `{}` — Vercel cron is NOT used; this is intentional.
- Env vars: `.env.example` (~34 vars) is the canonical list; `.env.test.example` for e2e.

## Commands you will need

| Purpose      | Command                | Expected on success                                           |
| ------------ | ---------------------- | ------------------------------------------------------------- |
| Format       | `bun run format`       | exit 0                                                        |
| Format check | `bun run format:check` | exit 0                                                        |
| Lint         | `bun run lint`         | exit 0                                                        |
| Typecheck    | `bun run type-check`   | exit 0 (unaffected by this plan; run as a no-regression gate) |

## Scope

**In scope** (the only files you should modify/create):

- `package.json` (remove two scripts only)
- `CLAUDE.md` (create)
- `README.md` (rewrite top, keep listed sections)

**Out of scope**:

- Any file under `src/` — this is a docs/scripts-only plan.
- `docs/ARCHITECTURE_V2.md` — completing it is a separate effort; link to it, don't edit it.
- Do not add new package scripts beyond removing the broken ones.

## Git workflow

- Branch: `advisor/001-claude-md-and-dx-fixes` off `develop`
- One commit per step is fine; message style: short imperative summary (matches repo history, e.g. "Update AI flow tests and improve navigation handling").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Remove the self-recursive audit scripts

In `package.json`, delete the two lines:

```json
"audit": "bun audit",
"audit:fix": "bun audit --fix",
```

With the script gone, `bun audit` resolves to bun's built-in dependency audit instead of recursing.

**Verify**: `grep -n '"audit"' package.json` → no output. `bun run lint` → exit 0.

### Step 2: Create CLAUDE.md

Create `/CLAUDE.md` with the following content. Verify each claim against the repo as you write it (e.g. confirm script names against `package.json`); fix anything that has drifted rather than copying blindly:

```markdown
# hoador-web

Peer-to-peer rental marketplace (item rentals + service bookings) with Stripe
payments, security-deposit holds, payouts, disputes, blind reviews,
communities/HOAs, messaging, and PWA push notifications.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Drizzle ORM on Neon Postgres ·
better-auth · Stripe + Stripe Connect · TanStack React Query · Tailwind 4 ·
Sentry · Resend (email) · web-push · OpenAI. Package manager: **bun** (do not
use npm/yarn/pnpm; lockfile is `bun.lockb`).

## Commands

- `bun install` — install deps
- `bun run dev` — dev server (turbopack)
- `bun run type-check` — tsc, no emit
- `bun run lint` / `bun run lint:fix`
- `bun run test:run` — vitest, full suite; pass a path to filter
- `bun run test:e2e` — Playwright (needs `docker compose up -d` + `.env.test`)
- `bun run format` / `bun run format:check` — prettier
- `bun run db:generate` / `db:migrate` / `db:push` / `db:studio` — drizzle-kit
- `bun run ci` — type-check + lint + coverage tests + build (what CI runs)

## Architecture (see docs/ARCHITECTURE_V2.md)

- **API routes** (`src/app/api/**/route.ts`) own auth. Use the helpers in
  `src/lib/api/route-helpers.ts`: `getAuthenticatedUserResponse()` (401 or
  `{user, userId, isAdmin}`), `requireAdminResponse()`, `requireAuthResponse()`,
  and `handleApiError()` in the catch. Validate bodies with Zod before use.
- **DAL** (`src/dal/*.dal.ts`) is auth-agnostic: pure DB operations, class per
  domain, extends `BaseDAL`. Never put session/permission checks in a DAL.
- **Services** (`src/features/<domain>/services/`) hold business logic and
  orchestrate DAL + Stripe + notifications.
- **Client data** goes through React Query against API routes. No server
  actions. Server pages may prefetch into the query cache and wrap children in
  `HydrateClient` (see `src/app/dashboard/mailbox/page.tsx` for the pattern).
- **Cron jobs** are GitHub Actions (`.github/workflows/cron-jobs.yml`) hitting
  `/api/cron/*` with `Authorization: Bearer $CRON_SECRET`, verified by
  `src/lib/api/verify-cron-secret.ts`. `vercel.json` is intentionally empty —
  Vercel cron is not used.

## Conventions

- Tests live in `__tests__/` next to the code under test; vitest + happy-dom;
  see TESTING.md for methodology. Route tests should mock the session module
  (`@/features/auth/utils/session`), not `@/lib/api/route-helpers`.
- Money amounts: Stripe works in integer cents; DB `numeric` columns are
  strings in TS. Convert deliberately at boundaries.
- Errors: throw `@/dal/errors` types (`NotFoundError`, `ValidationError`,
  `ConflictError`…) and let `handleApiError` map them to status codes.
- Fire-and-forget notifications use `.catch(captureNonCriticalError)` — never
  let a notification failure fail a money operation.
- Env: copy `.env.example` → `.env.local`. Local DB: `docker compose up -d`.

## Gotchas

- `develop` is the working branch; `main` is production. After merging
  develop→main, develop is reset hard to main (see README).
- `src/app/api/test/*` routes are e2e-only, guarded by
  `NODE_ENV !== "production" && E2E_TEST === "1"`.
- PDF generation uses puppeteer-core + @sparticuz/chromium (serverless), not
  the Playwright test stack.
- `plans/` contains advisor-generated implementation plans; see
  `plans/README.md` for status before starting overlapping work.
```

**Verify**: `bun run format:check` → exit 0 (run `bun run format` first if prettier wants to reflow the file). `test -f CLAUDE.md && echo ok` → `ok`.

### Step 3: Rewrite README.md top section

Replace lines 1-28 of `README.md` (everything before "## PWA push notifications (optional)") with a real intro. Keep all existing sections from "PWA push notifications" downward, unchanged. Target content for the new top:

````markdown
# hoador-web

Peer-to-peer rental marketplace: item rentals and service bookings with Stripe
payments, security-deposit holds, payouts, disputes, reviews, communities, and
messaging.

**Stack**: Next.js 16 (App Router) · React 19 · TypeScript · Drizzle ORM +
Neon Postgres · better-auth · Stripe Connect · TanStack React Query ·
Tailwind 4. Package manager: **bun**.

## Getting started

```bash
bun install
cp .env.example .env.local   # then fill in secrets
docker compose up -d          # local Postgres (or point DATABASE_URL at Neon)
bun run db:push               # sync schema
bun run dev                   # http://localhost:3000
```
````

## Checks

```bash
bun run type-check && bun run lint && bun run test:run
```

See `CLAUDE.md` for architecture and conventions, `TESTING.md` for test
methodology, and `docs/ARCHITECTURE_V2.md` for the API-route/DAL layering.

```

**Verify**: `grep -c "create-next-app" README.md` → `0`. `grep -c "PWA push notifications" README.md` → `1` (kept sections intact). `bun run format:check` → exit 0.

## Test plan

No unit tests — docs and script removal only. The verification greps above are the test.

## Done criteria

- [ ] `grep -n '"audit"' package.json` → no matches
- [ ] `CLAUDE.md` exists and `bun run format:check` exits 0
- [ ] `grep -c "create-next-app" README.md` → 0; PWA/E2E/Playwright/branch-sync/Vercel sections still present
- [ ] `bun run type-check` and `bun run lint` exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `package.json` scripts block no longer contains the `audit` entries (someone fixed it already) — skip Step 1, continue.
- A `CLAUDE.md` or `AGENTS.md` already exists — STOP and report; reconcile rather than overwrite.
- Any claim in the CLAUDE.md template contradicts what you find in the repo (e.g. a script was renamed) — fix the doc to match reality; if the contradiction is architectural (e.g. server actions ARE in use), STOP and report.

## Maintenance notes

- CLAUDE.md claims rot. When plans 002-008 land (security hardening, webhook audit, etc.), no CLAUDE.md change is needed, but a future migration off GitHub-Actions cron or off bun must update it.
- Reviewer should spot-check the conventions section against one real route and one real DAL file.
```
