import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

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
    getUserById: vi.fn().mockImplementation((id: string) =>
      Promise.resolve({
        id,
        email: `${id}@example.com`,
        firstName: "Test",
        lastName: "User",
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

vi.mock("@/features/rentals/notifications/payment-succeeded", () => ({
  sendPaymentSucceededNotificationToRenter: vi
    .fn()
    .mockResolvedValue(undefined),
  sendPaymentSucceededNotificationToOwner: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/rentals/notifications/rental-approved", () => ({
  sendRentalApprovedNotification: vi.fn().mockResolvedValue(undefined),
}));

import { rentalDAL } from "@/dal";

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
    process.env.VERCEL_URL = "localhost:3000";
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
});
