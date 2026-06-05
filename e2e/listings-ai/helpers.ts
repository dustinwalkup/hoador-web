import path from "node:path";
import { type Page, type Route, expect } from "@playwright/test";

import { E2E_PASSWORD } from "../auth/constants";

/** Pre-seeded active user from `src/db/seeds/e2e.seed.ts`. */
export const ACTIVE_USER_EMAIL = "active@e2e.test";

/** Small JPEGs that already ship in /public; we reuse them as fixture photos. */
export const FIXTURE_IMAGES: string[] = [
  path.resolve(process.cwd(), "public/images/stock/tent.jpg"),
  path.resolve(process.cwd(), "public/images/stock/yard-work.jpg"),
  path.resolve(process.cwd(), "public/images/placeholder.jpg"),
];

/**
 * Canonical AiDraft fixture for tests that mock the analyze route.
 *
 * Includes non-null `instructions` and `safetyNotes` so the SafetyDisclaimer
 * always renders, and leaves `categoryId` as null so the test can pick a
 * category manually (avoiding coupling to seed UUIDs).
 */
export const SAMPLE_AI_DRAFT = {
  name: "DeWalt 20V Cordless Drill",
  description:
    "Solid 20V cordless drill in good working condition. Comes with one battery and a keyless chuck.",
  categoryId: null as string | null,
  brand: "DeWalt",
  model: "DCD777C2",
  condition: "good" as const,
  specifications: { power: "20V MAX", weight: "3.4 lbs" },
  instructions: "Insert the battery, set the clutch, and squeeze the trigger.",
  safetyNotes:
    "Wear safety glasses. Keep hands clear of the bit while in motion.",
};

/** Sign in as the seeded active user and land on the dashboard. */
export async function loginActiveUser(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ACTIVE_USER_EMAIL);
  await page.getByLabel(/^password/i).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export type MockAnalyzeBehavior =
  | "success"
  | "low_confidence"
  | "rate_limited"
  | "server_error";

/**
 * Mock `/api/listings/analyze-image` so tests don't hit OpenAI.
 *
 * Pass an array to drive a sequence (first call uses `behaviors[0]`, second
 * uses `behaviors[1]`, etc.). Once the array is exhausted the last entry
 * repeats — convenient for "first call fails, retry succeeds" patterns.
 */
export async function mockAnalyzeRoute(
  page: Page,
  behaviors: MockAnalyzeBehavior | MockAnalyzeBehavior[],
): Promise<void> {
  const seq = Array.isArray(behaviors) ? behaviors : [behaviors];
  let callIdx = 0;

  await page.route("**/api/listings/analyze-image", async (route: Route) => {
    const behavior = seq[Math.min(callIdx, seq.length - 1)];
    callIdx++;

    switch (behavior) {
      case "success":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: SAMPLE_AI_DRAFT }),
        });
        return;
      case "low_confidence":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: null }),
        });
        return;
      case "rate_limited":
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({ error: "rate_limited" }),
        });
        return;
      case "server_error":
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "server error" }),
        });
        return;
    }
  });
}

/** Stage one or more fixture photos via the modal's hidden file input. */
export async function stagePhotosInModal(
  page: Page,
  files: string[] = FIXTURE_IMAGES.slice(0, 3),
): Promise<void> {
  const input = page.getByTestId("ai-modal-file-input");
  await input.setInputFiles(files);
  await expect(page.getByTestId("ai-modal-staged-photos")).toBeVisible();
}

/**
 * Open `/dashboard/listings/add` and assert the AI Listing Assistant modal
 * has appeared in the Choice state. Returns when the page is interactive.
 *
 * Uses `waitUntil: "commit"` so the goto returns as soon as the navigation
 * commits — not after the full `load` event. In dev mode, first-visit
 * compilation of this route can take 10+ seconds (Next.js Fast Refresh),
 * which previously blew through the 15s navigation timeout. The subsequent
 * `toBeVisible(timeout: 15_000)` covers waiting for the actual page render.
 */
export async function gotoCreateListingAndExpectModal(
  page: Page,
): Promise<void> {
  await page.goto("/dashboard/listings/add", { waitUntil: "commit" });
  await expect(page.getByTestId("ai-modal-choice")).toBeVisible({
    timeout: 15_000,
  });
}
