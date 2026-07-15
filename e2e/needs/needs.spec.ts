import { test, expect, type Page } from "@playwright/test";
import {
  loginAs,
  createTestNeed,
  deleteTestNeed,
  METRO_MEMBER_EMAIL,
  NEEDS_PROVIDER_EMAIL,
  OUT_OF_NETWORK_EMAIL,
  E2E_NEED_TITLE,
  E2E_NEED_DESCRIPTION,
} from "./helpers";

// ---------------------------------------------------------------------------
// 16.1  Post-a-need + feed visibility
// ---------------------------------------------------------------------------

test.describe("16.1 — Post a need + feed visibility", () => {
  test("metro member posts a rental need → share screen → need in own feed", async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);

    await loginAs(page, METRO_MEMBER_EMAIL);
    await page.goto("/dashboard/needs/new");
    await expect(page).toHaveURL(/\/dashboard\/needs\/new/);

    // Type toggle: "Rental" is already default — confirm the button is active.
    const rentalBtn = page.getByRole("button", { name: /^rental$/i });
    await expect(rentalBtn).toBeVisible();

    // Open the Category combobox and pick the first available option.
    await page.getByRole("combobox").click();
    await page.getByRole("option").first().click();

    // Fill title and description.
    await page.locator('input[name="title"]').fill(E2E_NEED_TITLE);
    await page.locator("textarea").fill(E2E_NEED_DESCRIPTION);

    // Submit the form.
    await page.getByRole("button", { name: /post need/i }).click();

    // Share success screen should appear.
    await expect(page.getByText("Need posted!")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole("button", { name: /copy link/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /view my need/i }),
    ).toBeVisible();

    // Navigate to the feed.
    await page.getByRole("link", { name: /back to feed/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/needs$/);

    // The new need should be visible in the feed.
    await expect(page.getByText(E2E_NEED_TITLE)).toBeVisible({
      timeout: 10_000,
    });

    // Cleanup: delete the need so it doesn't pollute other tests.
    await deleteTestNeed(request, E2E_NEED_TITLE);
  });

  test("out-of-network user does not see a KC Metro need", async ({
    page,
    request,
  }) => {
    // Seed a KC Metro need via test API (don't go through the UI).
    await createTestNeed(
      request,
      METRO_MEMBER_EMAIL,
      E2E_NEED_TITLE,
      E2E_NEED_DESCRIPTION,
    );

    // Login as the out-of-network user (legacy Test Network, not KC Metro).
    await loginAs(page, OUT_OF_NETWORK_EMAIL);
    await page.goto("/dashboard/needs");

    // The KC Metro need must NOT be visible to this user.
    await expect(page.getByText(E2E_NEED_TITLE)).not.toBeVisible();

    // Cleanup.
    await deleteTestNeed(request, E2E_NEED_TITLE);
  });
});

// ---------------------------------------------------------------------------
// 16.2  Create-listing-from-need → pre-fill → (notify → book → close in CI)
//
// The full booking loop (admin approve → notify → book → auto-close) requires
// Stripe and is covered by route-level integration tests:
//   src/app/api/admin/listings/[listingId]/approve/__tests__/route.test.ts
//   src/features/neighborhood-needs/services/__tests__/neighborhood-needs-service.test.ts
//
// What we validate here is the UI surface: a second KC Metro user sees the
// need, the "Create Listing" CTA appears, and the link carries the correct
// pre-fill query params for the listing form.
// ---------------------------------------------------------------------------

test.describe("16.2 — Provider views need + Create Listing CTA pre-fill", () => {
  let needId: string;

  test.beforeAll(async ({ request }) => {
    const need = await createTestNeed(
      request,
      METRO_MEMBER_EMAIL,
      E2E_NEED_TITLE,
      E2E_NEED_DESCRIPTION,
    );
    needId = need.id;
  });

  test.afterAll(async ({ request }) => {
    await deleteTestNeed(request, E2E_NEED_TITLE);
  });

  test("second KC Metro user sees the need in the feed", async ({ page }) => {
    await loginAs(page, NEEDS_PROVIDER_EMAIL);
    await page.goto("/dashboard/needs");

    // The need created by metro_member should be visible to this KC Metro user.
    await expect(page.getByText(E2E_NEED_TITLE)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("need detail page shows Create Listing CTA for non-owner", async ({
    page,
  }) => {
    await loginAs(page, NEEDS_PROVIDER_EMAIL);
    await page.goto(`/dashboard/needs/${needId}`);

    // The need title appears on the detail page.
    await expect(page.getByText(E2E_NEED_TITLE)).toBeVisible({
      timeout: 10_000,
    });

    // A non-owner viewing an open need gets the "Create Listing" CTA.
    const cta = page.getByRole("link", { name: /create listing/i });
    await expect(cta).toBeVisible();

    // The CTA href must include the needId and the need's title as pre-fill.
    const href = await cta.getAttribute("href");
    expect(href).toContain(`needId=${needId}`);
    expect(href).toContain("title=");
    expect(href).toContain("description=");
    expect(href).toContain("category=");
  });

  test("Create Listing CTA navigates to listing form with pre-filled values", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await loginAs(page, NEEDS_PROVIDER_EMAIL);
    await page.goto(`/dashboard/needs/${needId}`);

    const cta = page.getByRole("link", { name: /create listing/i });
    await expect(cta).toBeVisible({ timeout: 10_000 });
    await cta.click();

    // Should land on the listing add page.
    await expect(page).toHaveURL(/\/dashboard\/listings\/add/, {
      timeout: 15_000,
    });

    // The need title should be pre-filled in the listing name field.
    await expect(page.locator('input[name="name"]')).toHaveValue(
      E2E_NEED_TITLE,
      { timeout: 10_000 },
    );
  });

  test("owner does not see Create Listing CTA on their own need", async ({
    page,
  }) => {
    await loginAs(page, METRO_MEMBER_EMAIL);
    await page.goto(`/dashboard/needs/${needId}`);

    await expect(page.getByText(E2E_NEED_TITLE)).toBeVisible({
      timeout: 10_000,
    });

    // Owner should see Edit / Close, not "Create Listing".
    await expect(
      page.getByRole("link", { name: /create listing/i }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: /close need/i }),
    ).toBeVisible();
  });

  test("out-of-network user gets 404 on the need detail page", async ({
    page,
  }) => {
    await loginAs(page, OUT_OF_NETWORK_EMAIL);
    await page.goto(`/dashboard/needs/${needId}`);

    // The server renders 404 for out-of-network viewers — Next.js shows the
    // not-found page or a generic error page.
    await expect(page).not.toHaveURL(/\/dashboard\/needs\/[a-z0-9-]+$/, {
      timeout: 5_000,
    });
    // Either a 404 page or a redirect away — the need title must not be shown.
    await expect(page.getByText(E2E_NEED_TITLE)).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Regression sweep
// ---------------------------------------------------------------------------

test.describe("Regression — Neighborhood Needs nav entry point", () => {
  let navPage: Page;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    navPage = await ctx.newPage();
    await loginAs(navPage, METRO_MEMBER_EMAIL);
  });

  test.afterAll(async () => {
    await navPage.close();
  });

  test("Neighborhood Needs nav link is visible and navigates to the feed", async () => {
    const link = navPage.locator('a[href="/dashboard/needs"]').first();
    await expect(link).toBeVisible();

    await link.click();
    await expect(navPage).toHaveURL(/\/dashboard\/needs$/);
  });

  test("empty-state CTA appears when feed has no results after filter change", async () => {
    await navPage.goto("/dashboard/needs");

    // Switch to "Service" filter — if there are no service needs the empty
    // state coach renders. We can't guarantee this in the shared test DB
    // unless we also control the seed, so we only verify the filter button
    // exists and is interactive.
    const serviceBtn = navPage.getByRole("button", { name: /^service$/i });
    await expect(serviceBtn).toBeVisible();
    await serviceBtn.click();

    // After clicking Service, the feed either shows results or the empty state.
    // Both are acceptable; we just confirm no crash.
    await expect(navPage).toHaveURL(/\/dashboard\/needs$/);
  });
});
