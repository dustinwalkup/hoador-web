import { test, expect } from "@playwright/test";
import { E2E_USER_EMAIL_VERIFIED, E2E_USER_INCOMPLETE } from "./constants";
import { login } from "./helpers";

test.describe("Status-based redirect (re-login and navigation)", () => {
  test("login as email_verified user → redirect to community-select", async ({
    page,
  }) => {
    await login(page, E2E_USER_EMAIL_VERIFIED);
    await expect(page).toHaveURL(/\/community-select/);
  });

  test("login as incomplete_profile user → redirect to onboarding", async ({
    page,
  }) => {
    await login(page, E2E_USER_INCOMPLETE);
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("authenticated email_verified user navigates to /dashboard → redirect to community-select", async ({
    page,
  }) => {
    await login(page, E2E_USER_EMAIL_VERIFIED);
    await expect(page).toHaveURL(/\/community-select/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/community-select/);
  });

  test("authenticated email_verified user can still reach legacy /join-code", async ({
    page,
  }) => {
    await login(page, E2E_USER_EMAIL_VERIFIED);
    await expect(page).toHaveURL(/\/community-select/);

    // R1.5: the legacy invite-code page stays reachable by direct URL.
    await page.goto("/join-code");
    await expect(page).toHaveURL(/\/join-code/);
    await expect(
      page.getByRole("heading", { name: /join your community/i }),
    ).toBeVisible();
  });

  test("authenticated incomplete_profile user navigates to /dashboard → redirect to onboarding", async ({
    page,
  }) => {
    await login(page, E2E_USER_INCOMPLETE);
    await expect(page).toHaveURL(/\/onboarding/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding/);
  });
});
