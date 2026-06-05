import { test, expect } from "@playwright/test";

import {
  FIXTURE_IMAGES,
  SAMPLE_AI_DRAFT,
  gotoCreateListingAndExpectModal,
  loginActiveUser,
  mockAnalyzeRoute,
  stagePhotosInModal,
} from "./helpers";

test.describe("AI Listing Assistant flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginActiveUser(page);
  });

  test("AI happy path: choose AI → stage photos → generate → prefilled form → submit", async ({
    page,
  }) => {
    // This test exercises the full create-listing flow end-to-end (login,
    // navigate, AI generate, form fill, submit, navigate to rentals). Against
    // a Next.js dev server with cold routes, two of those navigations need
    // first-time compilation (~10s each). The default 30s test budget
    // doesn't leave room for both compiles plus the actual work.
    test.setTimeout(60_000);

    await mockAnalyzeRoute(page, "success");
    await gotoCreateListingAndExpectModal(page);

    await page.getByTestId("ai-modal-choice-ai").click();
    await expect(page.getByTestId("ai-modal-instructions")).toBeVisible();

    await stagePhotosInModal(page, FIXTURE_IMAGES.slice(0, 3));
    await expect(page.getByTestId("ai-modal-generate")).toBeEnabled();

    await page.getByTestId("ai-modal-generate").click();

    // Processing scene renders; the simulated step ticker plus the
    // evidence-display window will dissolve the modal within a few seconds.
    await expect(page.getByTestId("ai-modal-processing")).toBeVisible();

    // After success the modal closes and the form is revealed with prefill.
    await expect(page.getByTestId("ai-draft-notice")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("ai-safety-disclaimer")).toBeVisible();

    // At least one AI Suggested badge is visible.
    const anyBadge = page.locator('[data-testid^="ai-suggested-badge-"]');
    await expect(anyBadge.first()).toBeVisible();

    // Photos carried over. FormLabel renders as a div (Radix Form), so
    // we target by the input's `name` attribute — same pattern the existing
    // section tests use (`container.querySelector('input[name="name"]')`).
    await expect(page.locator('input[name="name"]')).toHaveValue(
      SAMPLE_AI_DRAFT.name,
    );

    // Pick a category manually (mock returned categoryId: null) and finish
    // the form so we can submit. The form has two `<button role="combobox">`
    // triggers — Category (first) and Condition (second). Radix renders the
    // FormLabel as a div, not a <label>, so `getByLabel` won't match.
    await page.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();

    await page.locator('input[name="dailyRate"]').fill("12");

    // Acknowledge owner policies. Required by the form's Zod schema —
    // submit is blocked until checked.
    await page
      .getByRole("checkbox", {
        name: /I have read and agree to the Owner Policies/i,
      })
      .check();

    await page.getByRole("button", { name: /^list an item$/i }).click();

    // On success the user is redirected to the rentals tab with pending_review.
    // Use `toHaveURL` (URL polling) instead of `waitForURL` so the assertion
    // doesn't wait for the destination route's `load` event — in dev mode,
    // first-visit compilation of `/dashboard/listings/rentals` can take 10+
    // seconds, blocking `load` long enough to exhaust the test timeout.
    await expect(page).toHaveURL(
      /\/dashboard\/listings\/rentals\?tab=pending_review/,
      { timeout: 30_000 },
    );
  });

  test("Choice → Manual: modal closes in place, no banner/disclaimer/badges", async ({
    page,
  }) => {
    await mockAnalyzeRoute(page, "success");
    await gotoCreateListingAndExpectModal(page);

    await page.getByTestId("ai-modal-choice-manual").click();

    // Modal dismissed; no AI primitives render.
    await expect(page.getByTestId("ai-modal-choice")).not.toBeVisible();
    await expect(page.getByTestId("ai-draft-notice")).not.toBeVisible();
    await expect(page.getByTestId("ai-safety-disclaimer")).not.toBeVisible();
    await expect(
      page.locator('[data-testid^="ai-suggested-badge-"]'),
    ).toHaveCount(0);

    // The standard form is interactive and still on the same URL — no
    // navigation should have occurred.
    await expect(page).toHaveURL(/\/dashboard\/listings\/add/);
    await expect(page.getByLabel(/listing name/i)).toBeVisible();
  });
});
