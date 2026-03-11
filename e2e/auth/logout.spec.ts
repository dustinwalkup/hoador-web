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

    // Retry navigation — in CI, session invalidation may not have propagated
    // to the server yet, causing /dashboard to redirect to / instead of /login.
    await expect(async () => {
      await page.goto("/dashboard", { waitUntil: "load", timeout: 10_000 });
      expect(page.url()).toMatch(/\/login/);
    }).toPass({ timeout: 20_000, intervals: [1_000, 2_000, 3_000] });
  });
});
