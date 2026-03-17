import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NotFoundError, ValidationError } from "@/dal/errors";

const mockRequireAdminResponse = vi.fn();
const mockGetAuthenticatedUserResponse = vi.fn();
const mockHandleApiError = vi.fn().mockImplementation((error: unknown) => {
  const err = error as { statusCode?: number; message?: string };
  const status = err.statusCode ?? 500;
  return new Response(
    JSON.stringify({ error: err.message ?? "Internal error" }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
});

vi.mock("@/lib/api/route-helpers", () => ({
  requireAdminResponse: () => mockRequireAdminResponse(),
  getAuthenticatedUserResponse: () => mockGetAuthenticatedUserResponse(),
  handleApiError: (error: unknown) => mockHandleApiError(error),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: unknown) => handler,
}));

const mockResetPayoutStatus = vi.fn();
const mockResetTransferStatus = vi.fn();
const mockReleaseDeposit = vi.fn();

vi.mock("@/features/admin/services/payment-lifecycle-admin-service", () => ({
  PaymentLifecycleAdminService: {
    resetPayoutStatus: (...args: unknown[]) => mockResetPayoutStatus(...args),
    resetTransferStatus: (...args: unknown[]) =>
      mockResetTransferStatus(...args),
    releaseDeposit: (...args: unknown[]) => mockReleaseDeposit(...args),
  },
}));

function setupAdminAuth() {
  mockRequireAdminResponse.mockResolvedValue(null);
  mockGetAuthenticatedUserResponse.mockResolvedValue({
    userId: "admin-1",
    user: {},
    isAdmin: true,
  });
}

describe("POST /api/admin/payments/lifecycle/[rentalId]/reset-payout-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAdminAuth();
  });

  it("returns 200 when valid state", async () => {
    mockResetPayoutStatus.mockResolvedValue({ success: true });

    const { POST } =
      await import("../lifecycle/[rentalId]/reset-payout-status/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/lifecycle/rental-1/reset-payout-status",
      {
        method: "POST",
        body: JSON.stringify({ reason: "retry" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, {
      params: Promise.resolve({ rentalId: "rental-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(mockResetPayoutStatus).toHaveBeenCalledWith(
      "rental-1",
      expect.objectContaining({ reason: "retry", adminId: "admin-1" }),
    );
  });

  it("returns 400 when invalid state (ValidationError)", async () => {
    mockResetPayoutStatus.mockRejectedValue(
      new ValidationError("Cannot reset when completed", "payoutStatus"),
    );

    const { POST } =
      await import("../lifecycle/[rentalId]/reset-payout-status/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/lifecycle/rental-1/reset-payout-status",
      { method: "POST" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ rentalId: "rental-1" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 403 when non-admin", async () => {
    mockRequireAdminResponse.mockResolvedValue(
      new Response(JSON.stringify({ error: "Admin privileges required" }), {
        status: 403,
      }),
    );

    const { POST } =
      await import("../lifecycle/[rentalId]/reset-payout-status/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/lifecycle/rental-1/reset-payout-status",
      { method: "POST" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ rentalId: "rental-1" }),
    });

    expect(res.status).toBe(403);
    expect(mockResetPayoutStatus).not.toHaveBeenCalled();
  });

  it("returns 404 when not found", async () => {
    mockResetPayoutStatus.mockRejectedValue(
      new NotFoundError("Payment lifecycle", "missing"),
    );

    const { POST } =
      await import("../lifecycle/[rentalId]/reset-payout-status/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/lifecycle/missing/reset-payout-status",
      { method: "POST" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ rentalId: "missing" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAdminResponse.mockResolvedValue(
      new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
      }),
    );

    const { POST } =
      await import("../lifecycle/[rentalId]/reset-payout-status/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/lifecycle/rental-1/reset-payout-status",
      { method: "POST" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ rentalId: "rental-1" }),
    });

    expect(res.status).toBe(401);
    expect(mockResetPayoutStatus).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/payments/lifecycle/[rentalId]/reset-transfer-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAdminAuth();
  });

  it("returns 200 when valid", async () => {
    mockResetTransferStatus.mockResolvedValue({ success: true });

    const { POST } =
      await import("../lifecycle/[rentalId]/reset-transfer-status/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/lifecycle/rental-1/reset-transfer-status",
      {
        method: "POST",
        body: JSON.stringify({ reason: "retry" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const res = await POST(req, {
      params: Promise.resolve({ rentalId: "rental-1" }),
    });

    expect(res.status).toBe(200);
    expect(mockResetTransferStatus).toHaveBeenCalledWith(
      "rental-1",
      expect.objectContaining({ adminId: "admin-1" }),
    );
  });

  it("returns 400 when invalid state", async () => {
    mockResetTransferStatus.mockRejectedValue(
      new ValidationError("Only failed can be reset", "ownerTransferStatus"),
    );

    const { POST } =
      await import("../lifecycle/[rentalId]/reset-transfer-status/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/lifecycle/rental-1/reset-transfer-status",
      { method: "POST" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ rentalId: "rental-1" }),
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/admin/payments/lifecycle/[rentalId]/release-deposit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAdminAuth();
  });

  it("returns 200 when valid (mock Stripe)", async () => {
    mockReleaseDeposit.mockResolvedValue({ success: true });

    const { POST } =
      await import("../lifecycle/[rentalId]/release-deposit/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/lifecycle/rental-1/release-deposit",
      { method: "POST" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ rentalId: "rental-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(mockReleaseDeposit).toHaveBeenCalledWith("rental-1", {
      adminId: "admin-1",
    });
  });

  it("returns 500 when Stripe fails", async () => {
    mockReleaseDeposit.mockRejectedValue(new Error("Stripe API error"));

    const { POST } =
      await import("../lifecycle/[rentalId]/release-deposit/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/lifecycle/rental-1/release-deposit",
      { method: "POST" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ rentalId: "rental-1" }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 400 when invalid state", async () => {
    mockReleaseDeposit.mockRejectedValue(
      new ValidationError("Only held can be released", "depositHoldStatus"),
    );

    const { POST } =
      await import("../lifecycle/[rentalId]/release-deposit/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/lifecycle/rental-1/release-deposit",
      { method: "POST" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ rentalId: "rental-1" }),
    });

    expect(res.status).toBe(400);
  });
});
