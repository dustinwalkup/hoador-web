import { test, expect } from "@playwright/test";
import {
  E2E_PASSWORD,
  E2E_USER_EMAIL_VERIFIED,
  E2E_USER_INCOMPLETE,
} from "./constants";

test.describe("Status-based redirect (re-login and navigation)", () => {
  test("login as email_verified user → redirect to join-code", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(E2E_USER_EMAIL_VERIFIED);
    await page.getByLabel(/^password/i).fill(E2E_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/join-code/);
  });

  test("login as incomplete_profile user → redirect to onboarding", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(E2E_USER_INCOMPLETE);
    await page.getByLabel(/^password/i).fill(E2E_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("authenticated email_verified user navigates to /dashboard → redirect to join-code", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(E2E_USER_EMAIL_VERIFIED);
    await page.getByLabel(/^password/i).fill(E2E_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/join-code/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/join-code/);
  });

  test("authenticated incomplete_profile user navigates to /dashboard → redirect to onboarding", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(E2E_USER_INCOMPLETE);
    await page.getByLabel(/^password/i).fill(E2E_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/onboarding/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding/);
  });
});
