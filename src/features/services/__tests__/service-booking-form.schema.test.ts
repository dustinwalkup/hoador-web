import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceBookingFormSchema } from "@/features/services/lib/service-booking-form.schema";

const basePayload = {
  proposedDate: "2025-07-01",
  proposedTime: "15:00",
  notes: "",
  paymentMethodId: "pm_test",
};

describe("createServiceBookingFormSchema", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts valid hourly values including hours", () => {
    const schema = createServiceBookingFormSchema(true);
    const r = schema.safeParse({
      ...basePayload,
      hours: "2",
    });
    expect(r.success).toBe(true);
  });

  it("rejects hourly when hours missing or not positive", () => {
    const schema = createServiceBookingFormSchema(true);
    expect(schema.safeParse({ ...basePayload, hours: "" }).success).toBe(false);
    expect(schema.safeParse({ ...basePayload, hours: "0" }).success).toBe(
      false,
    );
    expect(schema.safeParse({ ...basePayload, hours: "abc" }).success).toBe(
      false,
    );
  });

  it("accepts fixed pricing without validating hours content", () => {
    const schema = createServiceBookingFormSchema(false);
    const r = schema.safeParse({
      ...basePayload,
      hours: "not-a-number",
    });
    expect(r.success).toBe(true);
  });

  it("rejects past date and time", () => {
    const schema = createServiceBookingFormSchema(true);
    const r = schema.safeParse({
      ...basePayload,
      proposedDate: "2025-06-10",
      proposedTime: "10:00",
      hours: "1",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.flatten().fieldErrors.proposedDate?.length,
      ).toBeGreaterThan(0);
    }
  });

  it("rejects notes over 5000 characters", () => {
    const schema = createServiceBookingFormSchema(true);
    const r = schema.safeParse({
      ...basePayload,
      hours: "1",
      notes: "a".repeat(5001),
    });
    expect(r.success).toBe(false);
  });

  it("requires payment method id", () => {
    const schema = createServiceBookingFormSchema(true);
    const r = schema.safeParse({
      ...basePayload,
      hours: "1",
      paymentMethodId: "",
    });
    expect(r.success).toBe(false);
  });
});
