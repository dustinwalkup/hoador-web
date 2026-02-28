import { test, expect } from "@playwright/test";
import { E2E_PASSWORD, E2E_USER_ACTIVE } from "./constants";

test.describe("Logout and subsequent access", () => {
  test("login as active user → logout → navigate to /dashboard → redirect to login", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(E2E_USER_ACTIVE);
    await page.getByLabel(/^password/i).fill(E2E_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole("button", { name: /active user/i }).click();
    await page.getByRole("menuitem", { name: /log out/i }).click();

    await expect(page).toHaveURL(/\//);
    await page.waitForLoadState("networkidle");

    // Use client-side navigation instead of page.goto because the server-side
    // redirect (/dashboard → /login) fires so fast in CI that Chromium aborts
    // the request before Playwright can observe it (net::ERR_ABORTED).
    await page.evaluate(() => {
      window.location.href = "/dashboard";
    });
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
