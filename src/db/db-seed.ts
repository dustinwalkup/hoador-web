// Load environment variables FIRST
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "./schemas";

// This database connection is specifically for Node.js scripts like seeds
// It uses the standard PostgreSQL driver which is the most reliable for Node.js
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

/**
 * Neon requires SSL; the local docker Postgres in `compose.yaml` does not
 * support it at all and rejects the connection outright ("The server does not
 * support SSL connections"). Deciding per-target is what makes the documented
 * local workflow (`docker compose up -d` + a localhost DATABASE_URL) actually
 * usable for seeding, instead of silently only working against the cloud.
 */
const isLocalTarget =
  /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(DATABASE_URL);

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocalTarget ? false : { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema, logger: false });
