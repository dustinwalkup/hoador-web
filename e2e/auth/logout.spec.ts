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

    // Use "commit" because the server redirect (/dashboard → /login) can fire
    // before the "load" event, causing net::ERR_ABORTED with the default wait.
    await page.goto("/dashboard", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/login/);
  });
});
