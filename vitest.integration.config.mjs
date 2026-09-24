/// <reference types="vitest" />
import { defineConfig } from "vite";
import dotenv from "dotenv";
import path from "path";

/**
 * Real-Postgres integration tests (`*.integration.test.ts`), run with
 * `bun run test:integration`. For the things a mocked `db` cannot show: real
 * constraint errors and real two-connection races. Everything else belongs in
 * the default, mocked suite (vitest.config.mjs), which excludes these files.
 *
 * Needs a database with the current schema pushed:
 *   docker compose up -d && bun run db:push:e2e && bun run test:integration
 *
 * DATABASE_URL comes from the environment (CI) or, failing that, `.env.test`
 * (the same file the e2e scripts read). Every test truncates the tables it
 * touches, so never point this at a database whose data you want to keep.
 */
dotenv.config({ path: path.resolve(process.cwd(), ".env.test"), quiet: true });

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    environment: "node",
    globals: true,
    setupFiles: ["./src/test/integration/setup.ts"],
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      // `@/db/db` only uses the node-postgres pool (`db-e2e`) under this flag;
      // without it every DAL would talk to the Neon driver instead.
      E2E_TEST: "1",
    },
    // One shared database: files must not interleave their truncates.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
