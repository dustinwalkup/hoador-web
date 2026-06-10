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

## Checks

```bash
bun run type-check && bun run lint && bun run test:run
```

See `CLAUDE.md` for architecture and conventions, `TESTING.md` for test
methodology, and `docs/ARCHITECTURE_V2.md` for the API-route/DAL layering.

## PWA push notifications (optional)

To enable web push notifications, set VAPID keys in your environment (see `.env.example`):

- **VAPID_PUBLIC_KEY** – Public key for Web Push (safe to expose to the client).
- **VAPID_PRIVATE_KEY** – Private key for signing push payloads; **never commit or expose** this value.

Generate a key pair:

```bash
npx web-push generate-vapid-keys
```

Copy the keys into `.env.local` (or your deployment env). If these are unset, the push service will no-op and log a warning.

## Auth E2E tests

See **[docs/e2e-auth.md](docs/e2e-auth.md)** for full setup.

1. Start Postgres: `docker compose up -d` (or `bun run e2e:db:up`).
2. Run tests: `bun run test:e2e`.

First time: copy `.env.test.example` to `.env.test` and set `BETTER_AUTH_SECRET`.

## Playwright (rental agreement PDF generation)

Rental agreement PDF generation uses Playwright with Chromium only. For local development and CI, install Chromium:

```bash
npx playwright install chromium
```

## Syncing branches after merging develop into main

After merging `develop` into `main`, sync your local `develop` branch:

```bash
git checkout develop
git fetch origin
git reset --hard origin/main
git push origin develop --force
```

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
