import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { PaymentSetupRequiredError } from "@/features/payments/lib/errors";

const mockFetch = vi.fn().mockResolvedValue({ ok: true });

const mockRentalRequest = {
  id: "req-123",
  listingId: "listing-1",
  listingName: "Test Listing",
  renterId: "renter-1",
  ownerId: "owner-1",
  startDate: new Date("2025-02-01"),
  endDate: new Date("2025-02-05"),
  totalAmount: "60.00",
  securityDeposit: "0",
  deliveryRequested: false,
  deliveryAddress: null,
  deliveryFee: "0",
  setupRequested: false,
  setupFee: "0",
  serviceFee: "0",
  applicationFeeAmount: "12.00",
  ownerPayout: "48.00",
  platformNetRevenue: "12.00",
  message: null,
  paymentMethodId: "pm_123",
  paymentIntentId: null,
  status: "pending",
  createdAt: new Date(),
};

vi.mock("@/lib/api/route-helpers", () => ({
  handleApiError: vi.fn((err: unknown) => {
    if (err instanceof PaymentSetupRequiredError) {
      return NextResponse.json(
        {
          error: err.code,
          onboardingStatus: err.details.onboardingStatus,
          ...(err.details.missingCapabilities && {
            missingCapabilities: err.details.missingCapabilities,
          }),
          ...(err.details.reason && { reason: err.details.reason }),
        },
        { status: err.statusCode },
      );
    }
    throw err;
  }),
  parseFormData: vi.fn().mockResolvedValue({}),
  requireAuthResponse: vi.fn().mockResolvedValue(null),
  captureNonCriticalError: vi.fn(),
  getClientIP: vi.fn().mockReturnValue(null),
  getUserAgent: vi.fn().mockReturnValue(null),
}));

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: vi.fn().mockResolvedValue("owner-1"),
}));

vi.mock("@/dal", () => ({
  rentalDAL: {
    getRentalRequestById: vi.fn(),
    updateRentalRequestPaymentStatus: vi.fn().mockResolvedValue(undefined),
    updateRentalRequestPaymentMethod: vi.fn().mockResolvedValue(undefined),
    approveRentalRequest: vi.fn().mockResolvedValue(undefined),
    getRentalByRequestId: vi.fn().mockResolvedValue({ id: "rental-456" }),
    getApprovedRentalCountForRenter: vi.fn().mockResolvedValue(1),
  },
  auditLogDAL: {
    create: vi.fn().mockResolvedValue({}),
  },
  userDAL: {
    getOrCreateStripeCustomerId: vi.fn().mockResolvedValue("cus_123"),
    getConnectedAccountId: vi.fn().mockResolvedValue("acct_123"),
    isConnectOnboardingComplete: vi.fn().mockResolvedValue(true),
    updateConnectOnboardingStatus: vi.fn().mockResolvedValue(undefined),
    getUserById: vi.fn().mockImplementation((id: string) =>
      Promise.resolve({
        id,
        email: `${id}@example.com`,
        firstName: "Test",
        lastName: "User",
        stripeConnectedAccountId: "acct_123",
        connectChargesEnabled: true,
        connectPayoutsEnabled: true,
        connectOnboardingComplete: true,
      }),
    ),
  },
  paymentDAL: {
    createPayment: vi.fn().mockResolvedValue(undefined),
  },
  paymentLifecycleDAL: {
    create: vi.fn().mockResolvedValue({ id: "lifecycle-1" }),
  },
  userActivityDAL: {
    logActivity: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/db/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: "rental-456",
              requestId: "req-123",
            },
          ]),
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schemas/rentals.schema", () => ({
  rentals: {},
}));

const afterCallbacks: Array<Promise<void>> = [];
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: vi.fn((cb: () => Promise<void>) => {
      afterCallbacks.push(cb());
    }),
  };
});

vi.mock("@/services/stripe/deposit-hold", () => ({
  placeDepositHold: vi
    .fn()
    .mockResolvedValue({ success: false, error: "skipped" }),
}));

vi.mock("@/services/stripe/rental-payments", () => ({
  chargeRentalPayment: vi.fn().mockResolvedValue({
    id: "pi_123",
    status: "succeeded",
  }),
  authorizeSecurityDeposit: vi.fn().mockResolvedValue(null),
  getPaymentErrorMessage: vi.fn((err: unknown) => (err as Error)?.message),
  isRetryablePaymentError: vi.fn().mockReturnValue(false),
}));

vi.mock("@/services/stripe/connect", () => ({
  getAccountStatus: vi
    .fn()
    .mockResolvedValue({ chargesEnabled: true, payoutsEnabled: true }),
}));

vi.mock("@/features/rentals/notifications/payment-succeeded", () => ({
  sendPaymentSucceededNotificationToRenter: vi
    .fn()
    .mockResolvedValue(undefined),
  sendPaymentSucceededNotificationToOwner: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/rentals/notifications/rental-approved", () => ({
  sendRentalApprovedNotification: vi.fn().mockResolvedValue(undefined),
}));

import { rentalDAL, userDAL } from "@/dal";
import { getAccountStatus } from "@/services/stripe/connect";

describe("POST /api/rentals/[id]/approve", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rentalDAL.getRentalRequestById).mockResolvedValue(
      mockRentalRequest as Awaited<
        ReturnType<typeof rentalDAL.getRentalRequestById>
      >,
    );
    mockFetch.mockResolvedValue({ ok: true });
    process.env.INTERNAL_API_SECRET = "test-internal-secret";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns 200 on successful approval and triggers internal PDF generation (mock fetch)", async () => {
    const { POST } = await import("./route");
    const request = new NextRequest(
      "http://localhost:3000/api/rentals/req-123/approve",
      {
        method: "POST",
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "req-123" }),
    });

    expect(response.status).toBe(200);

    // Flush after() callbacks so PDF generation side effect completes
    await Promise.all(afterCallbacks.splice(0));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/internal/generate-rental-agreement"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-internal-secret",
        }),
        body: expect.stringContaining("req-123"),
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.rentalRequestId).toBe("req-123");
  });

  describe("Stripe Connect gating", () => {
    async function callApprove() {
      const { POST } = await import("./route");
      const request = new NextRequest(
        "http://localhost:3000/api/rentals/req-123/approve",
        { method: "POST" },
      );
      return POST(request, { params: Promise.resolve({ id: "req-123" }) });
    }

    it("returns 403 PAYMENT_SETUP_REQUIRED when owner has no Stripe Connect account", async () => {
      vi.mocked(userDAL.getUserById).mockResolvedValueOnce({
        id: "owner-1",
        email: "owner-1@example.com",
        firstName: "Test",
        lastName: "User",
        stripeConnectedAccountId: null,
        connectChargesEnabled: false,
        connectPayoutsEnabled: false,
        connectOnboardingComplete: false,
      } as Awaited<ReturnType<typeof userDAL.getUserById>>);

      const response = await callApprove();
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body).toEqual({
        error: "PAYMENT_SETUP_REQUIRED",
        onboardingStatus: "not_started",
        missingCapabilities: ["charges", "payouts"],
      });
      expect(getAccountStatus).not.toHaveBeenCalled();
    });

    it("returns 403 with onboardingStatus=pending when account exists but capabilities are off", async () => {
      vi.mocked(userDAL.getUserById).mockResolvedValueOnce({
        id: "owner-1",
        email: "owner-1@example.com",
        firstName: "Test",
        lastName: "User",
        stripeConnectedAccountId: "acct_123",
        connectChargesEnabled: false,
        connectPayoutsEnabled: false,
        connectOnboardingComplete: false,
      } as Awaited<ReturnType<typeof userDAL.getUserById>>);

      const response = await callApprove();
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("PAYMENT_SETUP_REQUIRED");
      expect(body.onboardingStatus).toBe("pending");
    });

    it("returns 403 with onboardingStatus=restricted when payouts capability is off", async () => {
      vi.mocked(userDAL.getUserById).mockResolvedValueOnce({
        id: "owner-1",
        email: "owner-1@example.com",
        firstName: "Test",
        lastName: "User",
        stripeConnectedAccountId: "acct_123",
        connectChargesEnabled: true,
        connectPayoutsEnabled: false,
        connectOnboardingComplete: true,
      } as Awaited<ReturnType<typeof userDAL.getUserById>>);

      const response = await callApprove();
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body).toEqual({
        error: "PAYMENT_SETUP_REQUIRED",
        onboardingStatus: "restricted",
        missingCapabilities: ["payouts"],
      });
    });

    it("returns 403 with regression when cached flags say verified but live shows payouts disabled", async () => {
      // Default getUserById mock returns verified — so cached fast-path passes.
      vi.mocked(getAccountStatus).mockResolvedValueOnce({
        chargesEnabled: true,
        payoutsEnabled: false,
      });

      const response = await callApprove();
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body).toMatchObject({
        error: "PAYMENT_SETUP_REQUIRED",
        onboardingStatus: "restricted",
        missingCapabilities: ["payouts"],
      });
      expect(userDAL.updateConnectOnboardingStatus).toHaveBeenCalledWith(
        "owner-1",
        { chargesEnabled: true, payoutsEnabled: false },
      );
    });

    it("returns 403 with reason=stripe_unreachable when live retrieve fails on non-transient error", async () => {
      vi.mocked(getAccountStatus).mockRejectedValueOnce(
        new Error("invalid request"),
      );

      const response = await callApprove();
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body).toEqual({
        error: "PAYMENT_SETUP_REQUIRED",
        onboardingStatus: "unknown",
        reason: "stripe_unreachable",
      });
    });
  });
});
