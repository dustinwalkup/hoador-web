import { test, expect, type Page } from "@playwright/test";
import {
  E2E_PRIMARY_COMMUNITY_NAME,
  E2E_SECONDARY_COMMUNITY_NAME,
  E2E_USER_METRO_MEMBER,
} from "./constants";
import { login } from "./helpers";

const switchFor = (community: string) =>
  new RegExp(`visible in ${community}`, "i");

// Scope to the "Community Visibility" card — the profile page has another
// card with a similarly-named "Save Changes" button.
const visibilityCard = (page: Page) =>
  page.locator('[data-slot="card"]', { hasText: "Community Visibility" });

test.describe("Community visibility settings (profile page)", () => {
  test("toggling a community off persists; the home community toggle is locked", async ({
    page,
  }) => {
    await login(page, E2E_USER_METRO_MEMBER);
    await page.goto("/dashboard/profile");

    const card = visibilityCard(page);
    await expect(card).toBeVisible();

    // Home (primary) community: switch is on and disabled.
    const primarySwitch = card.getByRole("switch", {
      name: switchFor(E2E_PRIMARY_COMMUNITY_NAME),
    });
    await expect(primarySwitch).toBeChecked();
    await expect(primarySwitch).toBeDisabled();

    // A non-primary community: starts visible, toggle it off and save.
    const secondarySwitch = card.getByRole("switch", {
      name: switchFor(E2E_SECONDARY_COMMUNITY_NAME),
    });
    await expect(secondarySwitch).toBeChecked();
    await secondarySwitch.click();
    await expect(secondarySwitch).not.toBeChecked();

    const patchResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/users/me/visibility") &&
        resp.request().method() === "PATCH",
    );
    await card.getByRole("button", { name: /save changes/i }).click();
    expect((await patchResponse).status()).toBe(200);

    // Reload — the off state persisted.
    await page.reload();
    const reloadedCard = visibilityCard(page);
    await expect(reloadedCard).toBeVisible();
    await expect(
      reloadedCard.getByRole("switch", {
        name: switchFor(E2E_SECONDARY_COMMUNITY_NAME),
      }),
    ).not.toBeChecked();
    await expect(
      reloadedCard.getByRole("switch", {
        name: switchFor(E2E_PRIMARY_COMMUNITY_NAME),
      }),
    ).toBeDisabled();
  });
});
