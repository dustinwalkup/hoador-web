import { test, expect } from "@playwright/test";
import { E2E_JOIN_CODE } from "./constants";
import { signupAndReachCommunitySelect } from "./helpers";

/**
 * R1.5 / R13.6: the original join-code flow is preserved as a private-invite
 * path. A freshly verified user can reach `/join-code` by direct URL and the
 * legacy code-based membership grant still works end to end.
 */
test.describe("Legacy /join-code path", () => {
  test("email_verified user can join via code by direct URL → onboarding", async ({
    page,
    request,
  }) => {
    await signupAndReachCommunitySelect(page, request);

    // Direct-URL access to the legacy page is still permitted.
    await page.goto("/join-code");
    await expect(page).toHaveURL(/\/join-code/);
    await expect(page.getByLabel(/community join code/i)).toBeVisible();

    await page.getByPlaceholder(/enter your join code/i).fill(E2E_JOIN_CODE);

    const joinResponse = page.waitForResponse((resp) =>
      resp.url().includes("/api/auth/join-community"),
    );
    await page.getByRole("button", { name: /join community/i }).click();
    expect((await joinResponse).status()).toBe(200);

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
    await expect(page.getByRole("form")).toBeVisible();
  });
});
