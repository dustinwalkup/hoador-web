import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRefundsCreate = vi.fn();

vi.mock("@/services/stripe/server", () => ({
  PAYMENT_SERVER_INSTANCE: {
    refunds: {
      create: (...args: unknown[]) => mockRefundsCreate(...args),
    },
  },
}));

import { processRefund } from "../refund";

describe("processRefund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultParams = {
    rentalId: "rental-1",
    chargeId: "ch_123",
    refundAmountCents: 5000,
    reason: "renter_cancellation_24h",
  };

  it("calls stripe.refunds.create() with charge ID and amount in cents", async () => {
    mockRefundsCreate.mockResolvedValue({ id: "re_123" });

    const result = await processRefund(defaultParams);

    expect(result).toEqual({ success: true, refundId: "re_123" });
    expect(mockRefundsCreate).toHaveBeenCalledWith(
      {
        charge: "ch_123",
        amount: 5000,
        metadata: {
          rentalId: "rental-1",
          reason: "renter_cancellation_24h",
        },
      },
      { idempotencyKey: "refund-rental-rental-1" },
    );
  });

  it("uses idempotency key refund-rental-{rentalId}", async () => {
    mockRefundsCreate.mockResolvedValue({ id: "re_456" });

    await processRefund({
      ...defaultParams,
      rentalId: "rental-abc",
    });

    expect(mockRefundsCreate).toHaveBeenCalledWith(expect.any(Object), {
      idempotencyKey: "refund-rental-rental-abc",
    });
  });

  it("includes rentalId and reason in refund metadata", async () => {
    mockRefundsCreate.mockResolvedValue({ id: "re_1" });

    await processRefund({
      ...defaultParams,
      reason: "owner_cancellation",
    });

    const createArgs = mockRefundsCreate.mock.calls[0][0];
    expect(createArgs.metadata).toEqual({
      rentalId: "rental-1",
      reason: "owner_cancellation",
    });
  });

  it("returns { success: true, refundId } on success", async () => {
    mockRefundsCreate.mockResolvedValue({ id: "re_xyz" });

    const result = await processRefund(defaultParams);

    expect(result).toEqual({ success: true, refundId: "re_xyz" });
  });

  it("returns { success: false, error } on Stripe error", async () => {
    mockRefundsCreate.mockRejectedValue(new Error("Charge already refunded"));

    const result = await processRefund(defaultParams);

    expect(result).toEqual({
      success: false,
      error: "Charge already refunded",
    });
  });

  it("passes optional metadata through to Stripe", async () => {
    mockRefundsCreate.mockResolvedValue({ id: "re_1" });

    await processRefund({
      ...defaultParams,
      metadata: { source: "admin_dashboard" },
    });

    const createArgs = mockRefundsCreate.mock.calls[0][0];
    expect(createArgs.metadata).toMatchObject({
      rentalId: "rental-1",
      reason: "renter_cancellation_24h",
      source: "admin_dashboard",
    });
  });

  it("handles non-Error throws with generic message", async () => {
    mockRefundsCreate.mockRejectedValue("string error");

    const result = await processRefund(defaultParams);

    expect(result).toEqual({
      success: false,
      error: "Unknown refund error",
    });
  });
});
