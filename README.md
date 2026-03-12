This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

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

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
