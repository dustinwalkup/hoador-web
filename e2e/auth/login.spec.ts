import { test, expect } from "@playwright/test";
import {
  E2E_PASSWORD,
  E2E_USER_ACTIVE,
  E2E_USER_UNVERIFIED,
} from "./constants";

test.describe("Login", () => {
  test("valid credentials (active user) → redirect to dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(E2E_USER_ACTIVE);
    await page.getByLabel(/^password/i).fill(E2E_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("invalid credentials → error message, no redirect to dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(E2E_USER_ACTIVE);
    await page.getByLabel(/^password/i).fill("WrongPassword1!");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByText(/invalid email or password|invalid.*credentials/i),
    ).toBeVisible();
  });

  test("unverified user (pending_verification) → denied or redirect to verify-email", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(E2E_USER_UNVERIFIED);
    await page.getByLabel(/^password/i).fill(E2E_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).not.toHaveURL(/\/dashboard/);

    // Either error on login page or redirect to verify-email (proxy redirects unverified users).
    const verifyMessage = page.getByText(
      /verify your email|email not verified|please verify your email address/i,
    );
    try {
      await expect(verifyMessage).toBeVisible({ timeout: 5000 });
    } catch {
      await expect(page).toHaveURL(/\/verify-email/);
    }
  });
});
