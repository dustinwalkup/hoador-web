import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPaymentIntentsCreate = vi.fn();
const mockPaymentIntentsCancel = vi.fn();

vi.mock("@/services/stripe/server", () => ({
  PAYMENT_SERVER_INSTANCE: {
    paymentIntents: {
      create: (...args: unknown[]) => mockPaymentIntentsCreate(...args),
      cancel: (...args: unknown[]) => mockPaymentIntentsCancel(...args),
    },
  },
}));

import {
  chargeRentalPayment,
  authorizeSecurityDeposit,
  releaseSecurityDeposit,
  isRetryablePaymentError,
} from "../rental-payments";

describe("chargeRentalPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultMetadata = {
    rentalRequestId: "req-1",
    listingId: "listing-1",
    ownerId: "owner-1",
    renterId: "renter-1",
    listingName: "Power Drill",
  };

  it("creates PaymentIntent with NO transfer_data property", async () => {
    mockPaymentIntentsCreate.mockResolvedValue({ id: "pi_123" });

    await chargeRentalPayment(
      "cus_123",
      "pm_456",
      100,
      defaultMetadata,
      "rental-charge-req-1",
    );

    const params = mockPaymentIntentsCreate.mock.calls[0][0];
    expect(params).not.toHaveProperty("transfer_data");
  });

  it("creates PaymentIntent with NO application_fee_amount property", async () => {
    mockPaymentIntentsCreate.mockResolvedValue({ id: "pi_123" });

    await chargeRentalPayment(
      "cus_123",
      "pm_456",
      100,
      defaultMetadata,
      "rental-charge-req-1",
    );

    const params = mockPaymentIntentsCreate.mock.calls[0][0];
    expect(params).not.toHaveProperty("application_fee_amount");
  });

  it("creates PaymentIntent with off_session: true, confirm: true, currency: usd", async () => {
    mockPaymentIntentsCreate.mockResolvedValue({ id: "pi_123" });

    await chargeRentalPayment(
      "cus_123",
      "pm_456",
      100,
      defaultMetadata,
      "rental-charge-req-1",
    );

    const params = mockPaymentIntentsCreate.mock.calls[0][0];
    expect(params.off_session).toBe(true);
    expect(params.confirm).toBe(true);
    expect(params.currency).toBe("usd");
  });

  it("passes idempotencyKey to Stripe API options", async () => {
    mockPaymentIntentsCreate.mockResolvedValue({ id: "pi_123" });

    await chargeRentalPayment(
      "cus_123",
      "pm_456",
      100,
      defaultMetadata,
      "rental-charge-req-1",
    );

    const options = mockPaymentIntentsCreate.mock.calls[0][1];
    expect(options).toEqual({ idempotencyKey: "rental-charge-req-1" });
  });

  it("sets paymentType: 'rental_charge' in metadata", async () => {
    mockPaymentIntentsCreate.mockResolvedValue({ id: "pi_123" });

    await chargeRentalPayment(
      "cus_123",
      "pm_456",
      100,
      defaultMetadata,
      "rental-charge-req-1",
    );

    const params = mockPaymentIntentsCreate.mock.calls[0][0];
    expect(params.metadata.paymentType).toBe("rental_charge");
  });

  it("includes all metadata fields", async () => {
    mockPaymentIntentsCreate.mockResolvedValue({ id: "pi_123" });

    await chargeRentalPayment(
      "cus_123",
      "pm_456",
      100,
      defaultMetadata,
      "rental-charge-req-1",
    );

    const params = mockPaymentIntentsCreate.mock.calls[0][0];
    expect(params.metadata).toEqual({
      rentalRequestId: "req-1",
      listingId: "listing-1",
      ownerId: "owner-1",
      renterId: "renter-1",
      listingName: "Power Drill",
      paymentType: "rental_charge",
    });
  });

  it("converts amount to cents correctly", async () => {
    mockPaymentIntentsCreate.mockResolvedValue({ id: "pi_123" });

    await chargeRentalPayment(
      "cus_123",
      "pm_456",
      75.5,
      defaultMetadata,
      "rental-charge-req-1",
    );

    const params = mockPaymentIntentsCreate.mock.calls[0][0];
    expect(params.amount).toBe(7550);
  });

  it("returns PaymentIntent on success", async () => {
    const mockPI = { id: "pi_123", status: "succeeded" };
    mockPaymentIntentsCreate.mockResolvedValue(mockPI);

    const result = await chargeRentalPayment(
      "cus_123",
      "pm_456",
      100,
      defaultMetadata,
      "rental-charge-req-1",
    );

    expect(result).toEqual(mockPI);
  });

  it("throws on Stripe API failure", async () => {
    mockPaymentIntentsCreate.mockRejectedValue(new Error("Card declined"));

    await expect(
      chargeRentalPayment(
        "cus_123",
        "pm_456",
        100,
        defaultMetadata,
        "rental-charge-req-1",
      ),
    ).rejects.toThrow("Card declined");
  });
});

describe("authorizeSecurityDeposit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const depositMetadata = {
    type: "security_deposit" as const,
    rentalRequestId: "req-1",
    listingId: "listing-1",
    renterId: "renter-1",
  };

  it("creates PaymentIntent with capture_method: manual", async () => {
    mockPaymentIntentsCreate.mockResolvedValue({ id: "pi_dep_123" });

    await authorizeSecurityDeposit("cus_123", "pm_456", 200, depositMetadata);

    const params = mockPaymentIntentsCreate.mock.calls[0][0];
    expect(params.capture_method).toBe("manual");
  });

  it("sets off_session: true, confirm: true, currency: usd", async () => {
    mockPaymentIntentsCreate.mockResolvedValue({ id: "pi_dep_123" });

    await authorizeSecurityDeposit("cus_123", "pm_456", 200, depositMetadata);

    const params = mockPaymentIntentsCreate.mock.calls[0][0];
    expect(params.off_session).toBe(true);
    expect(params.confirm).toBe(true);
    expect(params.currency).toBe("usd");
  });

  it("sets metadata paymentType to security_deposit_hold", async () => {
    mockPaymentIntentsCreate.mockResolvedValue({ id: "pi_dep_123" });

    await authorizeSecurityDeposit("cus_123", "pm_456", 200, depositMetadata);

    const params = mockPaymentIntentsCreate.mock.calls[0][0];
    expect(params.metadata.paymentType).toBe("security_deposit_hold");
  });

  it("passes idempotencyKey when provided", async () => {
    mockPaymentIntentsCreate.mockResolvedValue({ id: "pi_dep_123" });

    await authorizeSecurityDeposit(
      "cus_123",
      "pm_456",
      200,
      depositMetadata,
      "deposit-hold-rental-1",
    );

    const options = mockPaymentIntentsCreate.mock.calls[0][1];
    expect(options).toEqual({ idempotencyKey: "deposit-hold-rental-1" });
  });

  it("passes undefined options when no idempotencyKey", async () => {
    mockPaymentIntentsCreate.mockResolvedValue({ id: "pi_dep_123" });

    await authorizeSecurityDeposit("cus_123", "pm_456", 200, depositMetadata);

    const options = mockPaymentIntentsCreate.mock.calls[0][1];
    expect(options).toBeUndefined();
  });
});

describe("releaseSecurityDeposit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls stripe.paymentIntents.cancel() with correct PI ID", async () => {
    mockPaymentIntentsCancel.mockResolvedValue({
      id: "pi_dep_123",
      status: "canceled",
    });

    await releaseSecurityDeposit("pi_dep_123");

    expect(mockPaymentIntentsCancel).toHaveBeenCalledWith("pi_dep_123");
  });

  it("throws on Stripe API failure", async () => {
    mockPaymentIntentsCancel.mockRejectedValue(
      new Error("PaymentIntent not found"),
    );

    await expect(releaseSecurityDeposit("pi_bad")).rejects.toThrow(
      "PaymentIntent not found",
    );
  });
});

describe("isRetryablePaymentError", () => {
  it("returns false for generic Error", () => {
    expect(isRetryablePaymentError(new Error("generic"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isRetryablePaymentError("string")).toBe(false);
    expect(isRetryablePaymentError(null)).toBe(false);
  });
});
