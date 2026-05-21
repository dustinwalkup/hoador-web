import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  getUserByIdMock,
  updateConnectOnboardingStatusMock,
  getAccountStatusMock,
  isRetryablePaymentErrorMock,
  logGatingEventMock,
} = vi.hoisted(() => ({
  getUserByIdMock: vi.fn(),
  updateConnectOnboardingStatusMock: vi.fn(),
  getAccountStatusMock: vi.fn(),
  isRetryablePaymentErrorMock: vi.fn(),
  logGatingEventMock: vi.fn(),
}));

vi.mock("@/dal", () => ({
  userDAL: {
    getUserById: getUserByIdMock,
    updateConnectOnboardingStatus: updateConnectOnboardingStatusMock,
  },
}));

vi.mock("@/services/stripe/connect", () => ({
  getAccountStatus: getAccountStatusMock,
}));

vi.mock("@/services/stripe/rental-payments", () => ({
  isRetryablePaymentError: isRetryablePaymentErrorMock,
}));

vi.mock("../log-events", () => ({
  logGatingEvent: logGatingEventMock,
}));

import { assertConnectReady } from "../assert-connect-ready";
import { PaymentSetupRequiredError } from "../errors";

const VERIFIED_USER = {
  id: "user-1",
  stripeConnectedAccountId: "acct_123",
  connectChargesEnabled: true,
  connectPayoutsEnabled: true,
  connectOnboardingComplete: true,
};

const OPTS = { bookingType: "rental" as const, bookingId: "rental-99" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("assertConnectReady", () => {
  it("throws without calling Stripe when cached flags say not-verified (not_started)", async () => {
    getUserByIdMock.mockResolvedValue({
      ...VERIFIED_USER,
      stripeConnectedAccountId: null,
      connectChargesEnabled: false,
      connectPayoutsEnabled: false,
      connectOnboardingComplete: false,
    });

    await expect(assertConnectReady("user-1", OPTS)).rejects.toBeInstanceOf(
      PaymentSetupRequiredError,
    );
    expect(getAccountStatusMock).not.toHaveBeenCalled();
    expect(updateConnectOnboardingStatusMock).not.toHaveBeenCalled();
    expect(logGatingEventMock).toHaveBeenCalledWith(
      "accept_blocked_payment_setup_required",
      expect.objectContaining({
        userId: "user-1",
        bookingType: "rental",
        bookingId: "rental-99",
        onboardingStatus: "not_started",
      }),
    );
  });

  it("throws without calling Stripe when cached flags say pending", async () => {
    getUserByIdMock.mockResolvedValue({
      ...VERIFIED_USER,
      connectChargesEnabled: false,
      connectPayoutsEnabled: false,
      connectOnboardingComplete: false,
    });

    await expect(assertConnectReady("user-1", OPTS)).rejects.toMatchObject({
      code: "PAYMENT_SETUP_REQUIRED",
      details: expect.objectContaining({ onboardingStatus: "pending" }),
    });
    expect(getAccountStatusMock).not.toHaveBeenCalled();
  });

  it("throws without calling Stripe when cached flags say restricted", async () => {
    getUserByIdMock.mockResolvedValue({
      ...VERIFIED_USER,
      connectChargesEnabled: true,
      connectPayoutsEnabled: false,
      connectOnboardingComplete: true,
    });

    await expect(assertConnectReady("user-1", OPTS)).rejects.toMatchObject({
      code: "PAYMENT_SETUP_REQUIRED",
      details: expect.objectContaining({
        onboardingStatus: "restricted",
        missingCapabilities: ["payouts"],
      }),
    });
    expect(getAccountStatusMock).not.toHaveBeenCalled();
  });

  it("resolves when cached flags pass and live retrieve confirms both capabilities", async () => {
    getUserByIdMock.mockResolvedValue(VERIFIED_USER);
    getAccountStatusMock.mockResolvedValue({
      chargesEnabled: true,
      payoutsEnabled: true,
    });

    await expect(assertConnectReady("user-1", OPTS)).resolves.toBeUndefined();
    expect(getAccountStatusMock).toHaveBeenCalledWith("acct_123");
    expect(updateConnectOnboardingStatusMock).not.toHaveBeenCalled();
    expect(logGatingEventMock).not.toHaveBeenCalled();
  });

  it("syncs DB and throws when live retrieve shows capability regression", async () => {
    getUserByIdMock.mockResolvedValue(VERIFIED_USER);
    getAccountStatusMock.mockResolvedValue({
      chargesEnabled: true,
      payoutsEnabled: false,
    });

    await expect(assertConnectReady("user-1", OPTS)).rejects.toMatchObject({
      code: "PAYMENT_SETUP_REQUIRED",
      details: expect.objectContaining({
        onboardingStatus: "restricted",
        missingCapabilities: ["payouts"],
      }),
    });
    expect(updateConnectOnboardingStatusMock).toHaveBeenCalledWith("user-1", {
      chargesEnabled: true,
      payoutsEnabled: false,
    });
    expect(logGatingEventMock).toHaveBeenCalledWith(
      "accept_blocked_payment_setup_required",
      expect.objectContaining({
        onboardingStatus: "restricted",
        regression: true,
      }),
    );
  });

  it("retries once on transient Stripe error then succeeds", async () => {
    getUserByIdMock.mockResolvedValue(VERIFIED_USER);
    isRetryablePaymentErrorMock.mockReturnValue(true);
    getAccountStatusMock
      .mockRejectedValueOnce(new Error("rate-limited"))
      .mockResolvedValueOnce({ chargesEnabled: true, payoutsEnabled: true });

    const promise = assertConnectReady("user-1", OPTS);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(promise).resolves.toBeUndefined();
    expect(getAccountStatusMock).toHaveBeenCalledTimes(2);
  });

  it("throws stripe_unreachable when transient error persists after retry", async () => {
    getUserByIdMock.mockResolvedValue(VERIFIED_USER);
    isRetryablePaymentErrorMock.mockReturnValue(true);
    getAccountStatusMock
      .mockRejectedValueOnce(new Error("rate-limited"))
      .mockRejectedValueOnce(new Error("still rate-limited"));

    const promise = assertConnectReady("user-1", OPTS);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(promise).rejects.toMatchObject({
      code: "PAYMENT_SETUP_REQUIRED",
      details: {
        onboardingStatus: "unknown",
        reason: "stripe_unreachable",
      },
    });
    expect(getAccountStatusMock).toHaveBeenCalledTimes(2);
  });

  it("throws stripe_unreachable immediately on non-transient error (no retry)", async () => {
    getUserByIdMock.mockResolvedValue(VERIFIED_USER);
    isRetryablePaymentErrorMock.mockReturnValue(false);
    getAccountStatusMock.mockRejectedValue(
      new Error("invalid request — non-transient"),
    );

    await expect(assertConnectReady("user-1", OPTS)).rejects.toMatchObject({
      code: "PAYMENT_SETUP_REQUIRED",
      details: { onboardingStatus: "unknown", reason: "stripe_unreachable" },
    });
    expect(getAccountStatusMock).toHaveBeenCalledTimes(1);
  });

  it("includes bookingType=service in the log when called from service flow", async () => {
    getUserByIdMock.mockResolvedValue({
      ...VERIFIED_USER,
      stripeConnectedAccountId: null,
    });

    await expect(
      assertConnectReady("user-1", {
        bookingType: "service",
        bookingId: "sb-1",
      }),
    ).rejects.toBeDefined();
    expect(logGatingEventMock).toHaveBeenCalledWith(
      "accept_blocked_payment_setup_required",
      expect.objectContaining({ bookingType: "service", bookingId: "sb-1" }),
    );
  });
});
