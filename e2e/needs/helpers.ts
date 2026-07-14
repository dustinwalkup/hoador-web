import { type APIRequestContext, type Page, expect } from "@playwright/test";
import { E2E_PASSWORD } from "../auth/constants";

/** KC Metro member — home community "Foxcroft", visible to all KC Metro. */
export const METRO_MEMBER_EMAIL = "metro_member@e2e.test";

/**
 * A second KC Metro member — home community "Glen Arbor Estates", visible to
 * all KC Metro communities. Used as the "provider" role in needs E2E tests.
 */
export const NEEDS_PROVIDER_EMAIL = "pending_member@e2e.test";

/**
 * User in the legacy Test Network (not in KC Metro). Used to verify that
 * KC Metro needs are invisible to out-of-network users.
 */
export const OUT_OF_NETWORK_EMAIL = "active@e2e.test";

/** Unique marker prefix for needs created by E2E tests. */
export const E2E_NEED_TITLE = "[E2E] Need a Pressure Washer for Driveway";
export const E2E_NEED_DESCRIPTION =
  "Automated E2E test — looking to borrow a pressure washer for the weekend.";

/** Sign in and land on the dashboard. Navigates from /login; waits for redirect. */
export async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

/**
 * Create a neighborhood need via the test-only API route.
 * Returns the created need object.
 */
export async function createTestNeed(
  request: APIRequestContext,
  email: string,
  title: string,
  description: string,
  type: "rental" | "service" = "rental",
): Promise<{ id: string; title: string }> {
  const response = await request.post("/api/test/create-need", {
    data: { email, title, description, type },
  });
  expect(response.ok()).toBe(true);
  return response.json();
}

/**
 * Delete all needs with the given title via the test-only cleanup route.
 * Call in afterEach / afterAll to keep the test DB clean.
 */
export async function deleteTestNeed(
  request: APIRequestContext,
  title: string,
): Promise<void> {
  await request.post("/api/test/delete-need", { data: { title } });
}
