import { afterAll, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import type { Pool } from "pg";

/**
 * Per-test isolation for the real-Postgres suite: every test starts from empty
 * tables. `scripts/e2e-reset.ts` is not reused here: its list predates the
 * service tables and it loads `.env.test` and logs on import.
 *
 * The list is the tables these tests write, plus the unique-named lookups the
 * factories create (communities, categories). CASCADE clears everything that
 * references them (sessions, memberships, images, lifecycle rows, …), so a new
 * table hanging off `user` or `listings` is covered without editing this.
 */
const TRUNCATE_LIST = [
  `"user"`,
  "communities",
  "listing_categories",
  "listings",
  "rental_requests",
  "rentals",
  "rental_payment_lifecycle",
  "payments",
  "service_listing_categories",
  "service_listings",
  "service_bookings",
  "service_payment_lifecycle",
  // No FK to anything above, so CASCADE never reaches these.
  "legal_documents",
  "rate_limit_buckets",
].join(", ");

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Integration tests need a Postgres: set DATABASE_URL or create .env.test " +
      "(see .env.test.example), then `docker compose up -d && bun run db:push:e2e`.",
  );
}

// The same connection module the app uses under E2E_TEST=1 — not a second one.
const { db } = await import("@/db/db-e2e");

beforeEach(async () => {
  await db.execute(
    sql.raw(`TRUNCATE TABLE ${TRUNCATE_LIST} RESTART IDENTITY CASCADE`),
  );
});

afterAll(async () => {
  await (db as unknown as { $client: Pool }).$client.end();
});
