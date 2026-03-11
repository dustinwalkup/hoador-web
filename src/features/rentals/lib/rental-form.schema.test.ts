import { describe, it, expect } from "vitest";
import {
  validateDateRange,
  rentalFormSchema,
} from "@/features/rentals/lib/rental-form.schema";

describe("rental-form.schema", () => {
  describe("validateDateRange", () => {
    const minDays = 1;
    const maxDays = 30;

    it("returns valid for single-day rental when startDate equals endDate", () => {
      const date = new Date("2024-02-01");
      const result = validateDateRange(
        date,
        new Date(date.getTime()),
        minDays,
        maxDays,
      );
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("returns valid for multi-day range within limits", () => {
      const result = validateDateRange(
        new Date("2024-02-01"),
        new Date("2024-02-05"),
        minDays,
        maxDays,
      );
      expect(result.isValid).toBe(true);
    });

    it("returns invalid when endDate is before startDate", () => {
      const result = validateDateRange(
        new Date("2024-02-05"),
        new Date("2024-02-01"),
        minDays,
        maxDays,
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/on or after start date/i);
    });

    it("returns invalid when startDate or endDate is missing", () => {
      expect(
        validateDateRange(undefined, new Date(), minDays, maxDays).isValid,
      ).toBe(false);
      expect(
        validateDateRange(new Date(), undefined, minDays, maxDays).isValid,
      ).toBe(false);
    });

    it("returns invalid when days less than minimumRentalPeriod", () => {
      const result = validateDateRange(
        new Date("2024-02-01"),
        new Date("2024-02-02"),
        5,
        maxDays,
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/minimum rental period/i);
    });

    it("returns invalid when days exceed maximumRentalPeriod", () => {
      const result = validateDateRange(
        new Date("2024-02-01"),
        new Date("2024-03-05"),
        minDays,
        10,
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/maximum rental period/i);
    });
  });

  describe("rentalFormSchema date refine", () => {
    it("accepts single-day range (startDate equals endDate)", () => {
      const date = new Date("2024-02-01");
      const result = rentalFormSchema.safeParse({
        startDate: date,
        endDate: new Date(date.getTime()),
        deliveryMethod: "pickup",
        setupRequested: false,
        rentalAgreementAccepted: true,
        paymentMethodId: "pm_xxx",
      });
      expect(result.success).toBe(true);
    });

    it("rejects endDate before startDate", () => {
      const result = rentalFormSchema.safeParse({
        startDate: new Date("2024-02-05"),
        endDate: new Date("2024-02-01"),
        deliveryMethod: "pickup",
        setupRequested: false,
        rentalAgreementAccepted: true,
        paymentMethodId: "pm_xxx",
      });
      expect(result.success).toBe(false);
    });
  });
});
