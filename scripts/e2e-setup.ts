/**
 * E2E setup: push schema → truncate → seed. Use for local and CI.
 * Loads .env.test; ensure DATABASE_URL is set.
 * Uses db push (not migrate) so a fresh DB gets the current schema without
 * depending on migration history order.
 */
import dotenv from "dotenv";
import path from "path";
import { spawnSync } from "node:child_process";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

if (!process.env.DATABASE_URL) {
  console.error("E2E setup: DATABASE_URL is required. Set it in .env.test.");
  process.exit(1);
}

async function main(): Promise<void> {
  console.log("🔄 E2E setup: push schema → reset → seed\n");

  // 1. Push schema (current schema → DB; no migration history required)
  console.log("1/3 Pushing schema...");
  const push = spawnSync("bun", ["run", "db:push:e2e"], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: { ...process.env },
  });
  if (push.status !== 0) {
    console.error("E2E database push failed.");
    process.exit(1);
  }

  // 2. Reset (truncate)
  console.log("\n2/3 Resetting database...");
  const { runE2EReset } = await import("./e2e-reset");
  await runE2EReset();

  // 3. Seed
  console.log("\n3/3 Seeding E2E data...");
  const { main: seedMain } = await import("../src/db/seeds/e2e.seed");
  await seedMain();

  console.log("\n✅ E2E setup complete.");
}

main().catch((err) => {
  console.error("E2E setup failed:", err);
  process.exit(1);
});
