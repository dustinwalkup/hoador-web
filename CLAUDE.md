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
