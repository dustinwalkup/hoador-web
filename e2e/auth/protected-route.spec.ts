import { test, expect } from "@playwright/test";

test.describe("Unauthenticated access to protected route", () => {
  test("navigate to /dashboard without login → redirect to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain("callbackUrl");
  });
});
