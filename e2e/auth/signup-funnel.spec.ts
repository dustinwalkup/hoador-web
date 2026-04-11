import { test, expect } from "@playwright/test";
import { E2E_JOIN_CODE, E2E_PASSWORD } from "./constants";

test.describe("Signup-to-dashboard funnel (email/password)", () => {
  test("complete signup → verify-email → join-code → onboarding → dashboard", async ({
    page,
    request,
  }) => {
    const uniqueEmail = `e2e-${Date.now()}@e2e.test`;

    await page.goto("/signup");
    await expect(page).toHaveURL(/\/signup/);

    await page.getByLabel(/first name/i).fill("E2E");
    await page.getByLabel(/last name/i).fill("User");
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/^password/i).fill(E2E_PASSWORD);
    await page
      .getByRole("checkbox", { name: /terms of service|privacy/i })
      .check();
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/verify-email/);
    await expect(
      page.getByRole("heading", { name: /check your email/i }),
    ).toBeVisible();

    const lastEmailRes = await request.get(
      "/api/test/last-email?type=verification",
    );
    expect(lastEmailRes.ok()).toBe(true);
    const { url: verificationUrl } = (await lastEmailRes.json()) as {
      url: string | null;
    };
    expect(verificationUrl).toBeTruthy();

    // Use current origin so we hit the test server (e.g. 3001), not the link's origin (e.g. 3000).
    const verifyPath =
      new URL(verificationUrl!).pathname + new URL(verificationUrl!).search;
    await page.goto(new URL(verifyPath, page.url()).href);
    await expect(page).toHaveURL(/\/join-code/);
    await expect(page.getByLabel(/community join code/i)).toBeVisible();

    await page.getByPlaceholder(/enter your join code/i).fill(E2E_JOIN_CODE);

    const joinResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/auth/join-community"),
    );
    await page.getByRole("button", { name: /join community/i }).click();
    const joinResp = await joinResponsePromise;
    expect(joinResp.status()).toBe(200);

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
    await expect(page.getByRole("form")).toBeVisible();

    await page.getByLabel(/first name/i).fill("E2E");
    await page.getByLabel(/last name/i).fill("User");
    // Phone input has no id, so label isn't associated; use placeholder (matches onboarding-form PhoneInput).
    await page.getByPlaceholder(/\(555\)\s*123-4567/).fill("5551234567");
    await page.getByLabel(/street address/i).fill("123 E2E St");
    await page.getByLabel(/^city/i).fill("Test City");
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "California" }).click();
    await page.getByLabel(/zip code/i).fill("90210");
    await page.getByRole("button", { name: /complete profile/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /welcome back/i }),
    ).toBeVisible();
  });
});
