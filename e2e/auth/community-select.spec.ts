import { test, expect } from "@playwright/test";
import {
  E2E_PRIMARY_COMMUNITY_NAME,
  E2E_SECONDARY_COMMUNITY_NAME,
} from "./constants";
import { signupAndReachCommunitySelect } from "./helpers";

test.describe("Community selection (post-verification step)", () => {
  test("dropdown is populated and 'request your community' opens the modal", async ({
    page,
    request,
  }) => {
    await signupAndReachCommunitySelect(page, request);
    await expect(
      page.getByRole("heading", { name: /find your community/i }),
    ).toBeVisible();

    // Dropdown opens and lists seeded KC Metro communities.
    await page.getByLabel(/select your community/i).click();
    await expect(
      page.getByRole("option", { name: E2E_PRIMARY_COMMUNITY_NAME }),
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: E2E_SECONDARY_COMMUNITY_NAME }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // "Request your community" opens the request modal.
    await page.getByRole("button", { name: /request your community/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("selecting a community persists and redirects to onboarding", async ({
    page,
    request,
  }) => {
    await signupAndReachCommunitySelect(page, request);

    await page.getByLabel(/select your community/i).click();
    await page
      .getByRole("option", { name: E2E_PRIMARY_COMMUNITY_NAME })
      .click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });

    // The selection persisted server-side: the user's status is now
    // incomplete_profile, so the dashboard layout bounces them to onboarding
    // (rather than back to community-select).
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
  });

  test("can fall back to the legacy /join-code page from the form", async ({
    page,
    request,
  }) => {
    await signupAndReachCommunitySelect(page, request);

    await page.getByRole("link", { name: /enter it here/i }).click();
    await expect(page).toHaveURL(/\/join-code/);
    await expect(
      page.getByRole("heading", { name: /join your community/i }),
    ).toBeVisible();
  });
});
