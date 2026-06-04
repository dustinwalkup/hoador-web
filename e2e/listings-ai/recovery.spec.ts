import { test, expect } from "@playwright/test";

import {
  FIXTURE_IMAGES,
  gotoCreateListingAndExpectModal,
  loginActiveUser,
  mockAnalyzeRoute,
  stagePhotosInModal,
} from "./helpers";

test.describe("AI Listing Assistant — cancel and failure paths", () => {
  test.beforeEach(async ({ page }) => {
    await loginActiveUser(page);
  });

  test("Cancel from AI: photos carry over to the manual form, no AI prefill (Req 9.5)", async ({
    page,
  }) => {
    await mockAnalyzeRoute(page, "success");
    await gotoCreateListingAndExpectModal(page);

    await page.getByTestId("ai-modal-choice-ai").click();
    await stagePhotosInModal(page, FIXTURE_IMAGES.slice(0, 2));

    await page.getByTestId("ai-modal-cancel").click();

    // Modal dismissed.
    await expect(page.getByTestId("ai-modal-instructions")).not.toBeVisible();

    // No AI primitives.
    await expect(page.getByTestId("ai-draft-notice")).not.toBeVisible();
    await expect(page.getByTestId("ai-safety-disclaimer")).not.toBeVisible();
    await expect(
      page.locator('[data-testid^="ai-suggested-badge-"]'),
    ).toHaveCount(0);

    // Form photos section has the staged images carried over. The form's
    // PhotosSection renders previews via Next.js <Image>, each with
    // alt="Listing image N".
    await expect(
      page.getByRole("img", { name: /listing image 1/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: /listing image 2/i }),
    ).toBeVisible();
  });

  test("Failure (500): Error view with Try again + Continue manually; Continue manually carries photos", async ({
    page,
  }) => {
    await mockAnalyzeRoute(page, "server_error");
    await gotoCreateListingAndExpectModal(page);

    await page.getByTestId("ai-modal-choice-ai").click();
    await stagePhotosInModal(page, FIXTURE_IMAGES.slice(0, 1));
    await page.getByTestId("ai-modal-generate").click();

    // Error view appears with both recovery affordances visible.
    await expect(page.getByTestId("ai-modal-error")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("ai-modal-error-retry")).toBeVisible();
    await expect(
      page.getByTestId("ai-modal-error-continue-manually"),
    ).toBeVisible();

    await page.getByTestId("ai-modal-error-continue-manually").click();

    // Modal dismissed; no AI prefill; photos preserved.
    await expect(page.getByTestId("ai-modal-error")).not.toBeVisible();
    await expect(page.getByTestId("ai-draft-notice")).not.toBeVisible();
    await expect(
      page.getByRole("img", { name: /listing image 1/i }),
    ).toBeVisible();
  });

  test("Failure (429): Error view shows ONLY Continue manually — no Try again, no Add more photos", async ({
    page,
  }) => {
    await mockAnalyzeRoute(page, "rate_limited");
    await gotoCreateListingAndExpectModal(page);

    await page.getByTestId("ai-modal-choice-ai").click();
    await stagePhotosInModal(page, FIXTURE_IMAGES.slice(0, 1));
    await page.getByTestId("ai-modal-generate").click();

    await expect(page.getByTestId("ai-modal-error")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByTestId("ai-modal-error-continue-manually"),
    ).toBeVisible();
    // Per Req 9.2, rate-limited gets only "Continue manually".
    await expect(page.getByTestId("ai-modal-error-retry")).toHaveCount(0);
    await expect(page.getByTestId("ai-modal-error-add-photos")).toHaveCount(0);
  });

  test("Failure (low_confidence): all three recovery actions including Add more photos", async ({
    page,
  }) => {
    await mockAnalyzeRoute(page, "low_confidence");
    await gotoCreateListingAndExpectModal(page);

    await page.getByTestId("ai-modal-choice-ai").click();
    await stagePhotosInModal(page, FIXTURE_IMAGES.slice(0, 1));
    await page.getByTestId("ai-modal-generate").click();

    await expect(page.getByTestId("ai-modal-error")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("ai-modal-error-add-photos")).toBeVisible();
    await expect(page.getByTestId("ai-modal-error-retry")).toBeVisible();
    await expect(
      page.getByTestId("ai-modal-error-continue-manually"),
    ).toBeVisible();
  });

  test("Error → Try Again: re-enters Processing and a second AI call fires", async ({
    page,
  }) => {
    // First attempt fails, second succeeds.
    await mockAnalyzeRoute(page, ["server_error", "success"]);
    await gotoCreateListingAndExpectModal(page);

    await page.getByTestId("ai-modal-choice-ai").click();
    await stagePhotosInModal(page, FIXTURE_IMAGES.slice(0, 1));
    await page.getByTestId("ai-modal-generate").click();

    await expect(page.getByTestId("ai-modal-error")).toBeVisible({
      timeout: 10_000,
    });

    await page.getByTestId("ai-modal-error-retry").click();
    await expect(page.getByTestId("ai-modal-processing")).toBeVisible();

    // Second call succeeds → form prefills.
    await expect(page.getByTestId("ai-draft-notice")).toBeVisible({
      timeout: 10_000,
    });
  });
});
