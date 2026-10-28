import { describe, it, expect } from "vitest";
import { notificationCategoryPreferencesDAL } from "@/dal";
import { createUser } from "@/test/integration/factories";

/**
 * A PATCH to /api/notifications/preferences changes only the channels it names
 * (real DB). The mobile app sends one channel per switch
 * (`{neighborhood_needs: {push: false}}`), so a missing channel must keep the
 * stored value, or the category default when no row exists yet. It used to be
 * written as `true`: turning Needs push off on mobile turned Needs email on.
 */

async function prefsOf(userId: string) {
  const rows = await notificationCategoryPreferencesDAL.getByUserId(userId);
  return Object.fromEntries(
    rows.map((r) => [r.category, { email: r.email, push: r.push }]),
  );
}

describe("notificationCategoryPreferencesDAL.upsertMany (real DB)", () => {
  describe("with a stored row", () => {
    it("a push-only change keeps the stored email", async () => {
      const u = await createUser();
      await notificationCategoryPreferencesDAL.upsertMany(u.id, {
        messages: { email: false, push: true },
      });

      await notificationCategoryPreferencesDAL.upsertMany(u.id, {
        messages: { push: false },
      });

      expect((await prefsOf(u.id)).messages).toEqual({
        email: false,
        push: false,
      });
    });

    it("an email-only change keeps the stored push", async () => {
      const u = await createUser();
      await notificationCategoryPreferencesDAL.upsertMany(u.id, {
        neighborhood_needs: { email: false, push: false },
      });

      await notificationCategoryPreferencesDAL.upsertMany(u.id, {
        neighborhood_needs: { email: true },
      });

      expect((await prefsOf(u.id)).neighborhood_needs).toEqual({
        email: true,
        push: false,
      });
    });
  });

  describe("with no row yet (falls back to CATEGORY_DEFAULTS)", () => {
    it("Needs push-only change keeps the default email (off)", async () => {
      const u = await createUser();

      await notificationCategoryPreferencesDAL.upsertMany(u.id, {
        neighborhood_needs: { push: false },
      });

      expect((await prefsOf(u.id)).neighborhood_needs).toEqual({
        email: false,
        push: false,
      });
    });

    it("Needs email-only change keeps the default push (on)", async () => {
      const u = await createUser();

      await notificationCategoryPreferencesDAL.upsertMany(u.id, {
        neighborhood_needs: { email: true },
      });

      expect((await prefsOf(u.id)).neighborhood_needs).toEqual({
        email: true,
        push: true,
      });
    });

    it("a push-only change to an on-by-default category keeps email on", async () => {
      const u = await createUser();

      await notificationCategoryPreferencesDAL.upsertMany(u.id, {
        bookings: { push: false },
      });

      expect((await prefsOf(u.id)).bookings).toEqual({
        email: true,
        push: false,
      });
    });

    it("an email-only change to an on-by-default category keeps push on", async () => {
      const u = await createUser();

      await notificationCategoryPreferencesDAL.upsertMany(u.id, {
        payments: { email: false },
      });

      expect((await prefsOf(u.id)).payments).toEqual({
        email: false,
        push: true,
      });
    });
  });

  it("writes several categories in one call, each keeping its other channel", async () => {
    const u = await createUser();
    await notificationCategoryPreferencesDAL.upsertMany(u.id, {
      bookings: { email: false, push: true },
      disputes: { email: false, push: true },
    });

    // The mobile Rentals & bookings switch: one channel, three keys.
    await notificationCategoryPreferencesDAL.upsertMany(u.id, {
      bookings: { push: false },
      disputes: { push: false },
      reminders: { push: false },
    });

    const prefs = await prefsOf(u.id);
    expect(prefs.bookings).toEqual({ email: false, push: false });
    expect(prefs.disputes).toEqual({ email: false, push: false });
    expect(prefs.reminders).toEqual({ email: true, push: false });
  });

  it("a category with neither channel named is left alone", async () => {
    const u = await createUser();
    await notificationCategoryPreferencesDAL.upsertMany(u.id, {
      messages: { email: false, push: false },
    });

    await notificationCategoryPreferencesDAL.upsertMany(u.id, {
      messages: {},
      neighborhood_needs: {},
    });

    const prefs = await prefsOf(u.id);
    expect(prefs.messages).toEqual({ email: false, push: false });
    // No row created: the category keeps reading its default.
    expect(prefs).not.toHaveProperty("neighborhood_needs");
  });
});
