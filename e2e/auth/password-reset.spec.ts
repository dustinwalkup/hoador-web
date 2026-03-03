import { test, expect } from "@playwright/test";
import { E2E_USER_ACTIVE } from "./constants";

const NEW_PASSWORD = "NewE2ePassword1!";

test.describe("Password reset flow", () => {
  test("request reset → get URL from test API → set new password → login with new password", async ({
    page,
    request,
  }) => {
    await page.goto("/forgot-password");
    await page.getByLabel(/email/i).fill(E2E_USER_ACTIVE);
    await page
      .getByRole("button", { name: /send reset password email/i })
      .click();

    await expect(
      page.getByRole("heading", { name: /check your email/i }),
    ).toBeVisible();

    const lastEmailRes = await request.get("/api/test/last-email?type=reset");
    expect(lastEmailRes.ok()).toBe(true);
    const { url: resetUrl } = (await lastEmailRes.json()) as {
      url: string | null;
    };
    expect(resetUrl).toBeTruthy();

    // Use current origin so we hit the test server (e.g. 3001), not the link's origin (e.g. 3000).
    const resetPath = new URL(resetUrl!).pathname + new URL(resetUrl!).search;
    await page.goto(new URL(resetPath, page.url()).href);
    await expect(page).toHaveURL(/\/reset-password/);
    await page
      .getByRole("textbox", { name: "New Password", exact: true })
      .fill(NEW_PASSWORD);
    await page
      .getByRole("textbox", { name: "Confirm New Password", exact: true })
      .fill(NEW_PASSWORD);
    await page.getByRole("button", { name: /reset password/i }).click();

    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel(/email/i).fill(E2E_USER_ACTIVE);
    await page.getByLabel(/^password/i).fill(NEW_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });
});
