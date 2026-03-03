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
    // Navigate directly to the callback URL. This avoids the social sign-in
    // endpoint cold-start compilation in CI (which can exceed the URL timeout).
    // The full button → Google → callback flow is covered by the next test.
    await page.goto(`${baseURL}/api/auth/callback/google?code=e2e-test-google`);

    await expect(page).toHaveURL(/\/dashboard(?:\?|\/|$)/, { timeout: 15_000 });
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

    // Wait for hydration to complete so keypresses aren't lost to a re-render.
    await page.waitForLoadState("networkidle");

    const joinCodeInput = page.getByPlaceholder(/enter your join code/i);
    await joinCodeInput.click();
    await joinCodeInput.pressSequentially(E2E_JOIN_CODE, { delay: 50 });
    await expect(joinCodeInput).toHaveValue(E2E_JOIN_CODE);

    const joinResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/auth/join-community") &&
        res.request().method() === "POST",
      { timeout: 15_000 },
    );

    // Re-verify the value survived any late re-renders before clicking.
    await expect(joinCodeInput).toHaveValue(E2E_JOIN_CODE);
    await page.getByRole("button", { name: /join community/i }).click();
    const joinResponse = await joinResponsePromise;
    expect(
      joinResponse.ok(),
      `join-community API should succeed (got ${joinResponse.status})`,
    ).toBe(true);

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
  });
});
