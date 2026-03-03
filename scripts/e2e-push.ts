/**
 * Runs drizzle-kit push using DATABASE_URL from .env.test.
 * Use for E2E when migrations are incremental (e.g. schema evolved via push).
 * Push applies the current schema to the DB without migration history.
 */
import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

if (!process.env.DATABASE_URL) {
  console.error(
    "E2E push: DATABASE_URL is not set. Copy .env.test.example to .env.test.",
  );
  process.exit(1);
}

const result = spawnSync("npx", ["drizzle-kit", "push"], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: { ...process.env },
});

process.exit(result.status ?? 1);
