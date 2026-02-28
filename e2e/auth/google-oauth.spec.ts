import { test, expect } from "@playwright/test";
import { E2E_USER_EMAIL_VERIFIED, E2E_JOIN_CODE } from "./constants";

test.describe("Google OAuth (E2E mock)", () => {
  test.afterAll(async ({ request }) => {
    await request.post("/api/test/reset-user", {
      data: {
        email: E2E_USER_EMAIL_VERIFIED,
        status: "email_verified",
        removeCommunity: true,
        removeProvider: "google",
      },
    });
  });

  test("mock callback with code=e2e-test-google creates session and redirects to dashboard", async ({
    page,
    baseURL,
  }) => {
    const callbackUrl = `${baseURL}/api/auth/callback/google?code=e2e-test-google`;

    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (url.includes("accounts.google.com")) {
        return route.fulfill({
          status: 302,
          headers: { Location: callbackUrl },
        });
      }
      return route.continue();
    });

    await page.goto("/login");
    await page.getByRole("button", { name: /continue with google/i }).click();

    await expect(page).toHaveURL(/\/dashboard(?:\?|\/|$)/);
  });

  test("e2e_user=email_verified@e2e.test → redirect to join-code", async ({
    page,
    baseURL,
  }) => {
    const callbackUrl = `${baseURL}/api/auth/callback/google?code=e2e-test-google&e2e_user=${encodeURIComponent(E2E_USER_EMAIL_VERIFIED)}`;

    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (url.includes("accounts.google.com")) {
        return route.fulfill({
          status: 302,
          headers: { Location: callbackUrl },
        });
      }
      return route.continue();
    });

    await page.goto("/login");
    await page.getByRole("button", { name: /continue with google/i }).click();

    await expect(page).toHaveURL(/\/join-code/);

    const joinCodeInput = page.getByPlaceholder(/enter your join code/i);
    await joinCodeInput.click();
    // Use pressSequentially so React's onChange fires (controlled input);
    // fill() updates DOM only and react-hook-form state stays empty.
    await joinCodeInput.pressSequentially(E2E_JOIN_CODE);
    await expect(joinCodeInput).toHaveValue(E2E_JOIN_CODE);

    const joinResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/auth/join-community") &&
        res.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: /join community/i }).click();
    const joinResponse = await joinResponsePromise;
    expect(
      joinResponse.ok(),
      `join-community API should succeed (got ${joinResponse.status})`,
    ).toBe(true);

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
  });
});
