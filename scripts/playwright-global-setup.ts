/**
 * Playwright global setup: load .env.test, verify env, run E2E DB migrate → reset → seed.
 * Does not start the Next.js app (started by webServer or CI). Run with tsx/Node.
 */
import dotenv from "dotenv";
import path from "path";
import { spawnSync } from "node:child_process";

const root = path.resolve(process.cwd());
dotenv.config({ path: path.join(root, ".env.test") });

export default async function globalSetup(): Promise<void> {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "";
  const isExternal =
    (baseURL.startsWith("http://") || baseURL.startsWith("https://")) &&
    !baseURL.includes("localhost") &&
    !baseURL.includes("127.0.0.1");

  if (isExternal) {
    console.log(
      "E2E globalSetup: remote base URL detected, skipping local DB setup.",
    );
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error(
      "E2E globalSetup: DATABASE_URL is required. Set it in .env.test or in CI.",
    );
    process.exit(1);
  }
  if (process.env.E2E_TEST !== "1") {
    console.error(
      "E2E globalSetup: E2E_TEST=1 is required. Set it in .env.test or in CI.",
    );
    process.exit(1);
  }

  console.log("E2E globalSetup: running migrate → reset → seed...");
  const result = spawnSync("bun", ["run", "e2e:setup"], {
    stdio: "inherit",
    cwd: root,
    env: { ...process.env },
  });

  if (result.status !== 0) {
    console.error("E2E database reset/seed failed.");
    process.exit(1);
  }
}
