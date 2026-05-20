/**
 * Playwright config for auth E2E tests. Loads .env.test so baseURL and webServer
 * use the E2E app port (3001). The app must run with E2E_TEST=1 and .env.test
 * (started by webServer here, or manually in CI).
 */
import dotenv from "dotenv";
import path from "path";
import { defineConfig, devices } from "@playwright/test";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";

/** When testing against staging, baseURL is external; do not start a local webServer. */
const isExternalBaseURL =
  baseURL.startsWith("http://") || baseURL.startsWith("https://")
    ? !baseURL.includes("localhost") && !baseURL.includes("127.0.0.1")
    : false;

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 0 : 1,
  workers: 1,
  reporter: process.env.CI
    ? [
        ["list"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
        ["github"],
      ]
    : [
        ["list"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
      ],
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  expect: {
    timeout: 10_000,
  },
  timeout: 30_000,
  projects: [
    {
      name: "auth",
      testMatch: /e2e\/auth\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "services-uat",
      testMatch: /e2e\/services\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "payments",
      testMatch: /e2e\/payments\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  globalSetup: path.resolve(
    process.cwd(),
    "scripts/playwright-global-setup.ts",
  ),
  ...(isExternalBaseURL
    ? {}
    : {
        webServer: {
          command: "bun run dev -- -p 3001",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            ...process.env,
            E2E_TEST: "1",
            NEXT_PUBLIC_APP_URL: baseURL,
          },
        },
      }),
});
