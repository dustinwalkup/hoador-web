/**
 * Runs drizzle-kit migrate using DATABASE_URL from .env.test.
 * For use in E2E globalSetup and CI. Run from repo root.
 */
import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

if (!process.env.DATABASE_URL) {
  console.error(
    "E2E migrate: DATABASE_URL is not set. Copy .env.test.example to .env.test.",
  );
  process.exit(1);
}

const result = spawnSync("npx", ["drizzle-kit", "migrate"], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: { ...process.env },
});

process.exit(result.status ?? 1);
