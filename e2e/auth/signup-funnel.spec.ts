import { test, expect } from "@playwright/test";
import { E2E_PRIMARY_COMMUNITY_NAME } from "./constants";
import { signupAndReachCommunitySelect } from "./helpers";

test.describe("Signup-to-dashboard funnel (email/password)", () => {
  test("signup → verify-email → community-select → onboarding → dashboard", async ({
    page,
    request,
  }) => {
    await signupAndReachCommunitySelect(page, request);

    // Canonical post-verification step: pick a community from the dropdown.
    await expect(
      page.getByRole("heading", { name: /find your community/i }),
    ).toBeVisible();

    await page.getByLabel(/select your community/i).click();
    await page
      .getByRole("option", { name: E2E_PRIMARY_COMMUNITY_NAME })
      .click();

    const selectResponse = page.waitForResponse((resp) =>
      resp.url().includes("/api/auth/select-community"),
    );
    await page.getByRole("button", { name: /continue/i }).click();
    expect((await selectResponse).status()).toBe(200);

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
    await expect(page.getByRole("form")).toBeVisible();

    await page.getByLabel(/first name/i).fill("E2E");
    await page.getByLabel(/last name/i).fill("User");
    // Phone input has no id, so the label isn't associated; match by placeholder.
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
