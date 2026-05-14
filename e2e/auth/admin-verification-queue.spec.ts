import { test, expect } from "@playwright/test";
import { E2E_USER_ADMIN, E2E_USER_PENDING_MEMBER } from "./constants";
import { login } from "./helpers";

const PENDING_BADGE = /verification pending/i;

/**
 * R9.1 / R2.6: the admin residency-verification queue, end to end. These tests
 * run in order — the seeded `pending_member@e2e.test` starts with a `pending`
 * primary membership; the admin verifies it; the badge then disappears.
 */
test.describe("Admin verification queue", () => {
  test("pending user's profile shows the 'Verification Pending' badge", async ({
    page,
  }) => {
    await login(page, E2E_USER_PENDING_MEMBER);
    await page.goto("/dashboard/profile");
    await expect(page.getByText(PENDING_BADGE)).toBeVisible();
  });

  test("admin verifies the pending membership and the row leaves the queue", async ({
    page,
  }) => {
    await login(page, E2E_USER_ADMIN);
    await page.goto("/admin/dashboard/users");

    await page.getByRole("tab", { name: /pending verifications/i }).click();

    // The seeded pending member is in the queue.
    await expect(page.getByText(E2E_USER_PENDING_MEMBER)).toBeVisible();

    const verifyResponse = page.waitForResponse(
      (resp) =>
        /\/api\/admin\/community-memberships\/[^/]+\/verify$/.test(
          resp.url(),
        ) && resp.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    expect((await verifyResponse).status()).toBe(200);

    // Row is gone; queue is empty.
    await expect(page.getByText(E2E_USER_PENDING_MEMBER)).toBeHidden();
    await expect(page.getByText(/nothing to verify/i)).toBeVisible();
  });

  test("verified user's profile no longer shows the badge", async ({
    page,
  }) => {
    await login(page, E2E_USER_PENDING_MEMBER);
    await page.goto("/dashboard/profile");
    await expect(page.getByText(PENDING_BADGE)).toHaveCount(0);
  });
});
