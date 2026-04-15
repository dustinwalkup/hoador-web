import { test, expect, type Page } from "@playwright/test";
import {
  E2E_PASSWORD,
  E2E_USER_ACTIVE,
  E2E_USER_ADMIN,
} from "../auth/constants";

async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

/**
 * Maps to specs/services/phase1/4-uat-test-plan.md — scenarios runnable in E2E
 * without Stripe-dependent flows.
 */
test.describe("UAT-SVC-55: Services nav link available in dashboard", () => {
  test("Services link visible and navigates to /dashboard/services with active state", async ({
    page,
  }) => {
    await loginAs(page, E2E_USER_ACTIVE);

    const servicesLink = page.locator('a[href="/dashboard/services"]').first();
    await expect(servicesLink).toBeVisible();

    await servicesLink.click();
    await expect(page).toHaveURL(/\/dashboard\/services$/);

    await expect(
      page.locator('a[href="/dashboard/services"]').first(),
    ).toHaveAttribute("data-active", "true");
  });
});

test.describe("UAT-SVC-09: Admin review queue shows empty state", () => {
  test('shows "No listings pending review" when queue is empty', async ({
    page,
  }) => {
    await loginAs(page, E2E_USER_ADMIN);

    await page.goto("/admin/dashboard/services/listings/review");
    await expect(page).toHaveURL(
      /\/admin\/dashboard\/services\/listings\/review/,
    );

    await expect(
      page.getByText("No listings pending review", { exact: true }),
    ).toBeVisible();
  });
});

test.describe("UAT-SVC-10 (smoke): Resident can open services browse", () => {
  test("/dashboard/services loads for a logged-in resident", async ({
    page,
  }) => {
    await loginAs(page, E2E_USER_ACTIVE);
    await page.goto("/dashboard/services");
    await expect(page).toHaveURL(/\/dashboard\/services/);
    await expect(
      page.getByRole("heading", { name: /Explore nearby services/i }),
    ).toBeVisible();
  });
});
