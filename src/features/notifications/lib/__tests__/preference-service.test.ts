import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  shouldSendEmail,
  shouldSendPush,
  getCategoryPreferences,
} from "../preference-service";

vi.mock("@/dal", () => ({
  userDAL: {
    getUserPreferences: vi.fn(),
  },
  notificationCategoryPreferencesDAL: {
    getByUserId: vi.fn(),
  },
}));

import { userDAL, notificationCategoryPreferencesDAL } from "@/dal";

describe("preference-service", () => {
  const userId = "user-1";
  const category = "bookings" as const;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userDAL.getUserPreferences).mockResolvedValue({
      emailNotifications: true,
      pushNotifications: true,
    });
    vi.mocked(notificationCategoryPreferencesDAL.getByUserId).mockResolvedValue(
      [],
    );
  });

  describe("neighborhood_needs defaults", () => {
    it("shouldSendEmail returns false by default for neighborhood_needs", async () => {
      vi.mocked(
        notificationCategoryPreferencesDAL.getByUserId,
      ).mockResolvedValue([]);
      expect(await shouldSendEmail(userId, "neighborhood_needs")).toBe(false);
    });

    it("shouldSendPush returns false by default for neighborhood_needs", async () => {
      vi.mocked(
        notificationCategoryPreferencesDAL.getByUserId,
      ).mockResolvedValue([]);
      expect(await shouldSendPush(userId, "neighborhood_needs")).toBe(false);
    });

    it("shouldSendEmail returns true once user opts in for neighborhood_needs", async () => {
      vi.mocked(
        notificationCategoryPreferencesDAL.getByUserId,
      ).mockResolvedValue([
        {
          id: "pref-nn",
          userId,
          category: "neighborhood_needs",
          email: true,
          push: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as Awaited<
        ReturnType<typeof notificationCategoryPreferencesDAL.getByUserId>
      >);
      expect(await shouldSendEmail(userId, "neighborhood_needs")).toBe(true);
    });

    it("shouldSendPush returns true once user opts in for neighborhood_needs", async () => {
      vi.mocked(
        notificationCategoryPreferencesDAL.getByUserId,
      ).mockResolvedValue([
        {
          id: "pref-nn",
          userId,
          category: "neighborhood_needs",
          email: false,
          push: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as Awaited<
        ReturnType<typeof notificationCategoryPreferencesDAL.getByUserId>
      >);
      expect(await shouldSendPush(userId, "neighborhood_needs")).toBe(true);
    });
  });

  describe("shouldSendEmail", () => {
    it("returns false when master email is off", async () => {
      vi.mocked(userDAL.getUserPreferences).mockResolvedValue({
        emailNotifications: false,
        pushNotifications: true,
      });
      expect(await shouldSendEmail(userId, category)).toBe(false);
      expect(
        notificationCategoryPreferencesDAL.getByUserId,
      ).not.toHaveBeenCalled();
    });

    it("returns false when master on but category email is off", async () => {
      vi.mocked(
        notificationCategoryPreferencesDAL.getByUserId,
      ).mockResolvedValue([
        {
          id: "pref-1",
          userId,
          category: "bookings",
          email: false,
          push: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as Awaited<
        ReturnType<typeof notificationCategoryPreferencesDAL.getByUserId>
      >);
      expect(await shouldSendEmail(userId, category)).toBe(false);
    });

    it("returns true when master on and no category row (default)", async () => {
      vi.mocked(
        notificationCategoryPreferencesDAL.getByUserId,
      ).mockResolvedValue([]);
      expect(await shouldSendEmail(userId, category)).toBe(true);
    });

    it("returns true when master on and category email is on", async () => {
      vi.mocked(
        notificationCategoryPreferencesDAL.getByUserId,
      ).mockResolvedValue([
        {
          id: "pref-1",
          userId,
          category: "bookings",
          email: true,
          push: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as Awaited<
        ReturnType<typeof notificationCategoryPreferencesDAL.getByUserId>
      >);
      expect(await shouldSendEmail(userId, category)).toBe(true);
    });
  });

  describe("shouldSendPush", () => {
    it("returns false when master push is off", async () => {
      vi.mocked(userDAL.getUserPreferences).mockResolvedValue({
        emailNotifications: true,
        pushNotifications: false,
      });
      expect(await shouldSendPush(userId, category)).toBe(false);
      expect(
        notificationCategoryPreferencesDAL.getByUserId,
      ).not.toHaveBeenCalled();
    });

    it("returns false when master on but category push is off", async () => {
      vi.mocked(
        notificationCategoryPreferencesDAL.getByUserId,
      ).mockResolvedValue([
        {
          id: "pref-1",
          userId,
          category: "bookings",
          email: true,
          push: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as Awaited<
        ReturnType<typeof notificationCategoryPreferencesDAL.getByUserId>
      >);
      expect(await shouldSendPush(userId, category)).toBe(false);
    });

    it("returns true when master on and no category row (default)", async () => {
      vi.mocked(
        notificationCategoryPreferencesDAL.getByUserId,
      ).mockResolvedValue([]);
      expect(await shouldSendPush(userId, category)).toBe(true);
    });

    it("returns true when master on and category push is on", async () => {
      vi.mocked(
        notificationCategoryPreferencesDAL.getByUserId,
      ).mockResolvedValue([
        {
          id: "pref-1",
          userId,
          category: "bookings",
          email: true,
          push: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as Awaited<
        ReturnType<typeof notificationCategoryPreferencesDAL.getByUserId>
      >);
      expect(await shouldSendPush(userId, category)).toBe(true);
    });
  });

  describe("getCategoryPreferences", () => {
    it("returns master and category defaults when no rows exist", async () => {
      const result = await getCategoryPreferences(userId);
      expect(result.master).toEqual({
        email: true,
        push: true,
      });
      expect(result.categories.bookings).toEqual({
        email: true,
        push: true,
      });
      expect(result.categories.reminders).toEqual({
        email: true,
        push: true,
      });
    });

    it("defaults neighborhood_needs to email:false, push:false when no row exists", async () => {
      const result = await getCategoryPreferences(userId);
      expect(result.categories.neighborhood_needs).toEqual({
        email: false,
        push: false,
      });
    });

    it("returns category overrides when rows exist", async () => {
      vi.mocked(userDAL.getUserPreferences).mockResolvedValue({
        emailNotifications: true,
        pushNotifications: false,
      });
      vi.mocked(
        notificationCategoryPreferencesDAL.getByUserId,
      ).mockResolvedValue([
        {
          id: "pref-1",
          userId,
          category: "bookings",
          email: false,
          push: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as Awaited<
        ReturnType<typeof notificationCategoryPreferencesDAL.getByUserId>
      >);
      const result = await getCategoryPreferences(userId);
      expect(result.master.push).toBe(false);
      expect(result.categories.bookings).toEqual({
        email: false,
        push: true,
      });
    });
  });
});
