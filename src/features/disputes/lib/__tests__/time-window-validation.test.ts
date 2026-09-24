import { describe, it, expect, vi } from "vitest";
import { TimeWindowValidation } from "../time-window-validation";
import type { DisputeReasonCode } from "@/dal/types";

describe("TimeWindowValidation", () => {
  describe("calculateDeadline", () => {
    const baseStartDate = new Date("2024-01-01T00:00:00Z");
    const baseEndDate = new Date("2024-01-10T00:00:00Z");

    it("should calculate deadline for damage disputes (7 days after endDate)", () => {
      const deadline = TimeWindowValidation.calculateDeadline(
        baseStartDate,
        baseEndDate,
        "damage",
      );

      const expectedDeadline = new Date(baseEndDate);
      expectedDeadline.setDate(expectedDeadline.getDate() + 7);

      expect(deadline.getTime()).toBe(expectedDeadline.getTime());
    });

    it("should calculate deadline for non_delivery disputes (3 days after startDate)", () => {
      const deadline = TimeWindowValidation.calculateDeadline(
        baseStartDate,
        baseEndDate,
        "non_delivery",
      );

      const expectedDeadline = new Date(baseStartDate);
      expectedDeadline.setDate(expectedDeadline.getDate() + 3);

      expect(deadline.getTime()).toBe(expectedDeadline.getTime());
    });

    it("should calculate deadline for quality_issue disputes (7 days after endDate)", () => {
      const deadline = TimeWindowValidation.calculateDeadline(
        baseStartDate,
        baseEndDate,
        "quality_issue",
      );

      const expectedDeadline = new Date(baseEndDate);
      expectedDeadline.setDate(expectedDeadline.getDate() + 7);

      expect(deadline.getTime()).toBe(expectedDeadline.getTime());
    });

    it("should calculate deadline for cancellation disputes (2 days after startDate)", () => {
      const deadline = TimeWindowValidation.calculateDeadline(
        baseStartDate,
        baseEndDate,
        "cancellation",
      );

      const expectedDeadline = new Date(baseStartDate);
      expectedDeadline.setDate(expectedDeadline.getDate() + 2);

      expect(deadline.getTime()).toBe(expectedDeadline.getTime());
    });

    it("should calculate deadline for payment_issue disputes (30 days after endDate)", () => {
      const deadline = TimeWindowValidation.calculateDeadline(
        baseStartDate,
        baseEndDate,
        "payment_issue",
      );

      const expectedDeadline = new Date(baseEndDate);
      expectedDeadline.setDate(expectedDeadline.getDate() + 30);

      expect(deadline.getTime()).toBe(expectedDeadline.getTime());
    });

    it("should calculate deadline for other disputes (14 days after endDate)", () => {
      const deadline = TimeWindowValidation.calculateDeadline(
        baseStartDate,
        baseEndDate,
        "other",
      );

      const expectedDeadline = new Date(baseEndDate);
      expectedDeadline.setDate(expectedDeadline.getDate() + 14);

      expect(deadline.getTime()).toBe(expectedDeadline.getTime());
    });

    it("should handle month boundaries correctly", () => {
      const startDate = new Date("2024-01-28T00:00:00Z");
      const endDate = new Date("2024-01-30T00:00:00Z");

      const deadline = TimeWindowValidation.calculateDeadline(
        startDate,
        endDate,
        "damage",
      );

      // 7 days after Jan 30 = Feb 6 (in UTC)
      const expectedDeadline = new Date(endDate);
      expectedDeadline.setUTCDate(expectedDeadline.getUTCDate() + 7);

      expect(deadline.getTime()).toBe(expectedDeadline.getTime());
    });

    it("should handle year boundaries correctly", () => {
      const startDate = new Date("2023-12-28T00:00:00Z");
      const endDate = new Date("2023-12-31T00:00:00Z");

      const deadline = TimeWindowValidation.calculateDeadline(
        startDate,
        endDate,
        "damage",
      );

      // 7 days after Dec 31 = Jan 7, 2024 (in UTC)
      const expectedDeadline = new Date(endDate);
      expectedDeadline.setUTCDate(expectedDeadline.getUTCDate() + 7);

      expect(deadline.getTime()).toBe(expectedDeadline.getTime());
      expect(deadline.getUTCFullYear()).toBe(2024);
      expect(deadline.getUTCMonth()).toBe(0); // January
      expect(deadline.getUTCDate()).toBe(7);
    });
  });

  describe("validateTimeWindow", () => {
    it("should validate time window as valid when current time is before deadline", () => {
      // Use dates far enough in the future to ensure deadline is in the future
      // Even with timezone differences
      const farFutureStartDate = new Date("2030-01-01T00:00:00Z");
      const farFutureEndDate = new Date("2030-01-10T00:00:00Z");

      const result = TimeWindowValidation.validateTimeWindow(
        farFutureStartDate,
        farFutureEndDate,
        "damage",
      );

      expect(result.valid).toBe(true);
      expect(result.deadline).toBeDefined();
      expect(result.message).toBeUndefined();
    });

    it("should validate time window as invalid when current time is after deadline", () => {
      // Use past dates that are well beyond the deadline
      const oldStartDate = new Date("2020-01-01T00:00:00Z");
      const oldEndDate = new Date("2020-01-10T00:00:00Z");

      const result = TimeWindowValidation.validateTimeWindow(
        oldStartDate,
        oldEndDate,
        "damage",
      );

      expect(result.valid).toBe(false);
      expect(result.deadline).toBeDefined();
      expect(result.message).toContain("Time window expired");
      expect(result.message).toContain("Deadline was");
    });

    it("should validate exactly at deadline boundary (inclusive)", () => {
      // Freeze time so the deadline and "now" inside validateTimeWindow are identical
      const frozen = new Date("2024-06-01T12:00:00Z");
      vi.useFakeTimers({ now: frozen });

      // endDate 7 days ago → damage deadline = endDate + 7 = frozen
      const endDate = new Date(frozen);
      endDate.setDate(endDate.getDate() - 7);

      const result = TimeWindowValidation.validateTimeWindow(
        endDate,
        endDate,
        "damage",
      );

      // Should be valid (inclusive boundary)
      expect(result.valid).toBe(true);

      vi.useRealTimers();
    });

    it("should validate different reason codes correctly", () => {
      const reasonCodes: DisputeReasonCode[] = [
        "damage",
        "non_delivery",
        "quality_issue",
        "cancellation",
        "payment_issue",
        "other",
      ];

      // Use dates far enough in the future
      const farFutureStartDate = new Date("2030-01-01T00:00:00Z");
      const farFutureEndDate = new Date("2030-01-10T00:00:00Z");

      reasonCodes.forEach((reasonCode) => {
        const result = TimeWindowValidation.validateTimeWindow(
          farFutureStartDate,
          farFutureEndDate,
          reasonCode,
        );

        expect(result.valid).toBe(true);
        expect(result.deadline).toBeDefined();
      });
    });

    it("should return deadline in validation result", () => {
      const farFutureStartDate = new Date("2030-01-01T00:00:00Z");
      const farFutureEndDate = new Date("2030-01-10T00:00:00Z");

      const result = TimeWindowValidation.validateTimeWindow(
        farFutureStartDate,
        farFutureEndDate,
        "damage",
      );

      expect(result.deadline).toBeInstanceOf(Date);
      expect(result.deadline!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("getTimeWindowDescription", () => {
    it("should return correct description for damage disputes", () => {
      const description =
        TimeWindowValidation.getTimeWindowDescription("damage");

      expect(description).toBe("7 days after rental end date");
    });

    it("should return correct description for non_delivery disputes", () => {
      const description =
        TimeWindowValidation.getTimeWindowDescription("non_delivery");

      expect(description).toBe("3 days after rental start date");
    });

    it("should return correct description for quality_issue disputes", () => {
      const description =
        TimeWindowValidation.getTimeWindowDescription("quality_issue");

      expect(description).toBe("7 days after rental end date");
    });

    it("should return correct description for cancellation disputes", () => {
      const description =
        TimeWindowValidation.getTimeWindowDescription("cancellation");

      expect(description).toBe("2 days after cancellation");
    });

    it("should return correct description for payment_issue disputes", () => {
      const description =
        TimeWindowValidation.getTimeWindowDescription("payment_issue");

      expect(description).toBe("30 days after payment");
    });

    it("should return correct description for other disputes", () => {
      const description =
        TimeWindowValidation.getTimeWindowDescription("other");

      expect(description).toBe("14 days after rental end date");
    });
  });

  // Local-time constructors throughout: `parseServiceDayStart` reads the date
  // as local midnight, so these hold in any test-runner zone.
  describe("validateServiceFilingWindow", () => {
    const serviceDate = "2026-06-15";
    const serviceTime = "10:00";

    it("opens on the service day for a booking completed on time", () => {
      const completedAt = new Date(2026, 5, 15, 12, 0);

      expect(
        TimeWindowValidation.validateServiceFilingWindow(
          serviceDate,
          serviceTime,
          completedAt,
          new Date(2026, 5, 14, 12, 0),
        ).valid,
      ).toBe(false);
      expect(
        TimeWindowValidation.validateServiceFilingWindow(
          serviceDate,
          serviceTime,
          completedAt,
          new Date(2026, 5, 15, 18, 0),
        ),
      ).toEqual({
        valid: true,
        deadline: new Date(2026, 5, 16, 12, 0),
      });
    });

    // BIZ-02 regression. Completed two days early, the window used to open at
    // the service day's start and close 24h after completion — a day before
    // it opened. It is now [completedAt, completedAt + 24h].
    describe("after an early completion", () => {
      const completedAt = new Date(2026, 5, 13, 10, 0);

      it("is open right after completion", () => {
        expect(
          TimeWindowValidation.validateServiceFilingWindow(
            serviceDate,
            serviceTime,
            completedAt,
            new Date(2026, 5, 13, 20, 0),
          ),
        ).toEqual({
          valid: true,
          deadline: new Date(2026, 5, 14, 10, 0),
        });
      });

      it("is closed before completion", () => {
        expect(
          TimeWindowValidation.validateServiceFilingWindow(
            serviceDate,
            serviceTime,
            completedAt,
            new Date(2026, 5, 13, 9, 0),
          ).valid,
        ).toBe(false);
      });

      it("keeps the 24h close boundary", () => {
        const result = TimeWindowValidation.validateServiceFilingWindow(
          serviceDate,
          serviceTime,
          completedAt,
          new Date(2026, 5, 14, 11, 0),
        );
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/marked complete/);
      });
    });
  });
});
