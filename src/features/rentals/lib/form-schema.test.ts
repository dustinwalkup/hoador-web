import { describe, it, expect } from "vitest";
import { createRentalRequestSchema } from "@/features/rentals/lib/form-schema";

describe("createRentalRequestSchema", () => {
  const basePayload = {
    listingId: "a1b2c3d4-e5f6-4789-a012-345678901234",
    deliveryRequested: false,
    setupRequested: false,
    setupFee: 0,
    paymentMethodId: "pm_test_123",
  };

  it("accepts single-day rental when startDate equals endDate", () => {
    const sameDay = new Date("2024-02-01");
    const result = createRentalRequestSchema.safeParse({
      ...basePayload,
      startDate: sameDay,
      endDate: new Date(sameDay.getTime()),
    });
    expect(result.success).toBe(true);
  });

  it("accepts multi-day range when endDate is after startDate", () => {
    const result = createRentalRequestSchema.safeParse({
      ...basePayload,
      startDate: new Date("2024-02-01"),
      endDate: new Date("2024-02-05"),
    });
    expect(result.success).toBe(true);
  });

  it("rejects when endDate is before startDate", () => {
    const result = createRentalRequestSchema.safeParse({
      ...basePayload,
      startDate: new Date("2024-02-05"),
      endDate: new Date("2024-02-01"),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const endDateError = result.error.flatten().fieldErrors.endDate;
      expect(endDateError).toBeDefined();
      expect(endDateError?.[0]).toMatch(/on or after start date/i);
    }
  });
});
