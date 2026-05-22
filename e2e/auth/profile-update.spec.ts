import { test, expect, type Page } from "@playwright/test";
import { E2E_USER_ACTIVE } from "./constants";
import { login } from "./helpers";

// Scope to the "Personal Information" card — the profile page has multiple
// cards (Profile Picture, Community Visibility) that share button/label names.
const personalInfoCard = (page: Page) =>
  page.locator('[data-slot="card"]', { hasText: "Personal Information" });

const editDialog = (page: Page) =>
  page.getByRole("dialog", { name: /personal information/i });

test.describe("Profile update (modal)", () => {
  test("edit opens a modal, saves changes, and persists after reload", async ({
    page,
  }) => {
    await login(page, E2E_USER_ACTIVE);
    await page.goto("/dashboard/profile");

    const card = personalInfoCard(page);
    await expect(card).toBeVisible();

    // The card starts in read-only mode (no inputs visible).
    await expect(card.locator("input")).toHaveCount(0);

    await card.getByTestId("edit-profile-button").click();

    // Dialog opens with the current values seeded into the form.
    const dialog = editDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/first name/i)).toHaveValue("Active");
    await expect(dialog.getByLabel(/last name/i)).toHaveValue("User");

    // Update first name, bio, and phone (phone was null in the seed).
    const newFirstName = `Active-${Date.now().toString().slice(-5)}`;
    const newBio = "Updated bio from profile-update e2e test.";

    await dialog.getByLabel(/first name/i).fill(newFirstName);
    await dialog.getByLabel(/bio/i).fill(newBio);
    await dialog.getByLabel(/phone/i).fill("5551234567");

    const patchResponse = page.waitForResponse(
      (resp) =>
        resp.url().endsWith("/api/profile") &&
        resp.request().method() === "PATCH",
    );

    await dialog.getByRole("button", { name: /save changes/i }).click();

    const response = await patchResponse;
    expect(response.status()).toBe(200);

    // Dialog closes on success.
    await expect(dialog).toBeHidden();

    // Read-only view reflects the new values.
    const refreshedCard = personalInfoCard(page);
    await expect(refreshedCard.getByText(newFirstName)).toBeVisible();
    await expect(refreshedCard.getByText(newBio)).toBeVisible();
    await expect(refreshedCard.getByText("(555) 123-4567")).toBeVisible();

    // Reload — values persisted server-side.
    await page.reload();
    const reloadedCard = personalInfoCard(page);
    await expect(reloadedCard).toBeVisible();
    await expect(reloadedCard.getByText(newFirstName)).toBeVisible();
    await expect(reloadedCard.getByText(newBio)).toBeVisible();
    await expect(reloadedCard.getByText("(555) 123-4567")).toBeVisible();
  });

  test("cancel closes the modal without saving and resets edits", async ({
    page,
  }) => {
    await login(page, E2E_USER_ACTIVE);
    await page.goto("/dashboard/profile");

    const card = personalInfoCard(page);
    await card.getByTestId("edit-profile-button").click();

    const dialog = editDialog(page);
    await expect(dialog).toBeVisible();

    const originalFirstName = await dialog
      .getByLabel(/first name/i)
      .inputValue();

    await dialog.getByLabel(/first name/i).fill("Discarded");
    await dialog.getByRole("button", { name: /cancel/i }).click();

    await expect(dialog).toBeHidden();

    // Re-open: the field is reseeded from server state, not the discarded edit.
    await card.getByTestId("edit-profile-button").click();
    const reopenedDialog = editDialog(page);
    await expect(reopenedDialog.getByLabel(/first name/i)).toHaveValue(
      originalFirstName,
    );
  });

  test("invalid phone shows a validation error and blocks submit", async ({
    page,
  }) => {
    await login(page, E2E_USER_ACTIVE);
    await page.goto("/dashboard/profile");

    await personalInfoCard(page).getByTestId("edit-profile-button").click();
    const dialog = editDialog(page);
    await expect(dialog).toBeVisible();

    // Fewer than 10 digits — formatted as (555) 123- and rejected by zod.
    await dialog.getByLabel(/phone/i).fill("555123");

    let patchFired = false;
    page.on("response", (resp) => {
      if (
        resp.url().endsWith("/api/profile") &&
        resp.request().method() === "PATCH"
      ) {
        patchFired = true;
      }
    });

    await dialog.getByRole("button", { name: /save changes/i }).click();

    await expect(
      dialog.getByText(/valid 10-digit phone number/i),
    ).toBeVisible();
    expect(patchFired).toBe(false);
    await expect(dialog).toBeVisible();
  });
});
