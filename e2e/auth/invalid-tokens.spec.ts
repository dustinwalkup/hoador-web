import { test, expect } from "@playwright/test";

test.describe("Invalid or expired verification/reset tokens", () => {
  test("verification URL with invalid token → error state, no verification", async ({
    page,
  }) => {
    await page.goto("/signup/email/callback?error=invalid_token");

    await expect(page).toHaveURL(/\/signup\?error=/);
    await expect(page).not.toHaveURL(/\/join-code/);
  });

  test("reset password URL with invalid token → error, no password change", async ({
    page,
  }) => {
    await page.goto("/reset-password?token=invalid-token");
    await page
      .getByRole("textbox", { name: "New Password", exact: true })
      .fill("Password1");
    await page
      .getByRole("textbox", { name: "Confirm New Password" })
      .fill("Password1");
    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/auth/reset-password") &&
        res.request().method() === "POST",
    );
    await page.getByRole("button", { name: /reset password/i }).click();
    await responsePromise;

    await expect(
      page.getByRole("paragraph").filter({
        hasText: /invalid reset link|invalid|expired|request a new/i,
      }),
    ).toBeVisible();
  });
});
