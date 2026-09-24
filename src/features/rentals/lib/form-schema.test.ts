import { describe, it, expect } from "vitest";
import { createRentalRequestSchema } from "@/features/rentals/lib/form-schema";

describe("createRentalRequestSchema", () => {
  const basePayload = {
    listingId: "a1b2c3d4-e5f6-4789-a012-345678901234",
    deliveryRequested: false,
    setupRequested: false,
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

  // SEC-03: the fee is priced from the listing. Older clients (the shipped
  // mobile app included) still send one; it must be dropped, not rejected.
  it.each([0, 20, -499.5])(
    "accepts and drops a client-supplied setupFee of %s",
    (setupFee) => {
      const result = createRentalRequestSchema.safeParse({
        ...basePayload,
        deliveryRequested: true,
        deliveryAddress: "1 Main St",
        setupRequested: true,
        setupFee,
        startDate: new Date("2024-02-01"),
        endDate: new Date("2024-02-05"),
      });
      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty("setupFee");
    },
  );
});
