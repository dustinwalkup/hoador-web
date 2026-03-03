/**
 * E2E test database connection. Used only when E2E_TEST=1.
 * Uses node-postgres (pg.Pool), not Neon. Do not use for app in production.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "./schemas";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "E2E database: DATABASE_URL is required when E2E_TEST=1. Set it in .env.test.",
  );
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema, logger: false });
