import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NotFoundError } from "@/dal/errors";

const mockRequireAdminResponse = vi.fn();
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
  handleApiError: (error: unknown) => mockHandleApiError(error),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: unknown) => handler,
}));

const mockGetLifecycleList = vi.fn();
const mockGetLifecycleDetail = vi.fn();
const mockGetPaymentMetrics = vi.fn();
const mockGetFinancialMetrics = vi.fn();

vi.mock("@/features/admin/services/payment-lifecycle-admin-service", () => ({
  PaymentLifecycleAdminService: {
    getLifecycleList: (...args: unknown[]) => mockGetLifecycleList(...args),
    getLifecycleDetail: (...args: unknown[]) => mockGetLifecycleDetail(...args),
    getPaymentMetrics: (...args: unknown[]) => mockGetPaymentMetrics(...args),
    getFinancialMetrics: (...args: unknown[]) =>
      mockGetFinancialMetrics(...args),
  },
}));

describe("GET /api/admin/payments/lifecycle (list)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminResponse.mockResolvedValue(null);
  });

  it("returns paginated results when admin", async () => {
    const listResult = {
      data: [
        {
          rentalId: "r1",
          renterName: "Renter",
          ownerName: "Owner",
          listingName: "Listing",
          depositHoldStatus: "held",
          ownerTransferStatus: "pending",
          payoutStatus: "processing",
          updatedAt: new Date().toISOString(),
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    mockGetLifecycleList.mockResolvedValue(listResult);

    const { GET } = await import("../lifecycle/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/lifecycle?page=1&limit=20",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(listResult);
    expect(mockGetLifecycleList).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 20,
      }),
    );
  });

  it("passes filters from query params", async () => {
    mockGetLifecycleList.mockResolvedValue({ data: [], pagination: {} });

    const { GET } = await import("../lifecycle/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/lifecycle?depositHoldStatus=held&payoutStatus=failed&search=foo",
    );
    await GET(req);

    expect(mockGetLifecycleList).toHaveBeenCalledWith(
      expect.objectContaining({
        depositHoldStatus: ["held"],
        payoutStatus: ["failed"],
        search: "foo",
      }),
    );
  });

  it("returns 403 when non-admin", async () => {
    mockRequireAdminResponse.mockResolvedValue(
      new Response(JSON.stringify({ error: "Admin privileges required" }), {
        status: 403,
      }),
    );

    const { GET } = await import("../lifecycle/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/lifecycle",
    );
    const res = await GET(req);

    expect(res.status).toBe(403);
    expect(mockGetLifecycleList).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAdminResponse.mockResolvedValue(
      new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
      }),
    );

    const { GET } = await import("../lifecycle/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/lifecycle",
    );
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(mockGetLifecycleList).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/payments/lifecycle/[rentalId] (detail)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminResponse.mockResolvedValue(null);
  });

  it("returns full detail when admin and found", async () => {
    const detail = {
      lifecycle: { rentalId: "r1", payoutStatus: "completed" },
      rental: { rentalId: "r1", totalAmount: "100", securityDeposit: "50" },
      dispute: null,
      auditLogEntries: [],
    };
    mockGetLifecycleDetail.mockResolvedValue(detail);

    const { GET } = await import("../lifecycle/[rentalId]/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/lifecycle/r1",
    );
    const res = await GET(req, {
      params: Promise.resolve({ rentalId: "r1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(detail);
    expect(mockGetLifecycleDetail).toHaveBeenCalledWith("r1");
  });

  it("returns 404 when not found", async () => {
    mockGetLifecycleDetail.mockRejectedValue(
      new NotFoundError("Payment lifecycle", "missing"),
    );

    const { GET } = await import("../lifecycle/[rentalId]/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/lifecycle/missing",
    );
    const res = await GET(req, {
      params: Promise.resolve({ rentalId: "missing" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 403 when non-admin", async () => {
    mockRequireAdminResponse.mockResolvedValue(
      new Response(JSON.stringify({ error: "Admin privileges required" }), {
        status: 403,
      }),
    );

    const { GET } = await import("../lifecycle/[rentalId]/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/lifecycle/r1",
    );
    const res = await GET(req, {
      params: Promise.resolve({ rentalId: "r1" }),
    });

    expect(res.status).toBe(403);
    expect(mockGetLifecycleDetail).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAdminResponse.mockResolvedValue(
      new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
      }),
    );

    const { GET } = await import("../lifecycle/[rentalId]/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/lifecycle/r1",
    );
    const res = await GET(req, {
      params: Promise.resolve({ rentalId: "r1" }),
    });

    expect(res.status).toBe(401);
    expect(mockGetLifecycleDetail).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/payments/metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminResponse.mockResolvedValue(null);
  });

  it("returns financial metrics when admin", async () => {
    const metrics = {
      grossVolume: "1500.00",
      platformRevenue: "350.00",
      ownerPayouts: "1150.00",
      needsAttention: {
        failedTransfers: 0,
        frozenTransfers: 0,
        failedDeposits: 0,
        failedReleases: 0,
        expiredDeposits: 0,
        staleProcessing: 0,
      },
    };
    mockGetFinancialMetrics.mockResolvedValue(metrics);

    const { GET } = await import("../metrics/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/metrics?days=30",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(metrics);
    expect(mockGetFinancialMetrics).toHaveBeenCalledWith(30);
  });

  it("defaults to 30 days when no days param provided", async () => {
    mockGetFinancialMetrics.mockResolvedValue({
      grossVolume: "0",
      platformRevenue: "0",
      ownerPayouts: "0",
      needsAttention: {
        failedTransfers: 0,
        frozenTransfers: 0,
        failedDeposits: 0,
        failedReleases: 0,
        expiredDeposits: 0,
        staleProcessing: 0,
      },
    });

    const { GET } = await import("../metrics/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/metrics",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockGetFinancialMetrics).toHaveBeenCalledWith(30);
  });

  it("returns 403 when non-admin", async () => {
    mockRequireAdminResponse.mockResolvedValue(
      new Response(JSON.stringify({ error: "Admin privileges required" }), {
        status: 403,
      }),
    );

    const { GET } = await import("../metrics/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/metrics",
    );
    const res = await GET(req);

    expect(res.status).toBe(403);
    expect(mockGetFinancialMetrics).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAdminResponse.mockResolvedValue(
      new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
      }),
    );

    const { GET } = await import("../metrics/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/metrics",
    );
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(mockGetFinancialMetrics).not.toHaveBeenCalled();
  });
});
