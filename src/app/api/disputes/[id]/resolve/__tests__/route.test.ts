import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ValidationError, NotFoundError } from "@/dal/errors";

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
const mockParseFormData = vi.fn();

vi.mock("@/lib/api/route-helpers", () => ({
  getAuthenticatedUserResponse: (...args: unknown[]) =>
    mockGetAuthenticatedUserResponse(...args),
  handleApiError: (...args: unknown[]) => mockHandleApiError(...args),
  parseFormData: (...args: unknown[]) => mockParseFormData(...args),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (
    handler: (
      req: NextRequest,
      ctx: { params: Promise<{ id: string }> },
    ) => Promise<Response>,
  ) => handler,
}));

const mockResolveDispute = vi.fn();
vi.mock("@/features/disputes/services/dispute-resolution-service", () => ({
  DisputeResolutionService: {
    resolveDispute: (...args: unknown[]) => mockResolveDispute(...args),
  },
}));

describe("POST /api/disputes/[id]/resolve", () => {
  const disputeId = "dsp_123";

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUserResponse.mockResolvedValue({
      userId: "admin-123",
      isAdmin: true,
    });
    mockParseFormData.mockResolvedValue({
      outcome: "favor_provider",
      reason: "Evidence supports provider claim for damage",
    });
  });

  it("POST favor_provider → 200", async () => {
    const mockResult = {
      dispute: { id: disputeId, status: "resolved", outcome: "favor_provider" },
      depositOperationStatus: "captured" as const,
    };
    mockResolveDispute.mockResolvedValue(mockResult);

    const { POST } = await import("../route");
    const request = new NextRequest(
      `http://localhost:3000/api/disputes/${disputeId}/resolve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: "favor_provider",
          reason: "Evidence supports provider claim for damage",
        }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: disputeId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("resolved");
    expect(body.outcome).toBe("favor_provider");
    expect(body.depositOperationStatus).toBe("captured");
    expect(mockResolveDispute).toHaveBeenCalledWith(
      expect.objectContaining({
        disputeId,
        outcome: "favor_provider",
        reason: "Evidence supports provider claim for damage",
        adminId: "admin-123",
      }),
    );
  });

  it("POST favor_renter → 200", async () => {
    const mockResult = {
      dispute: { id: disputeId, status: "resolved", outcome: "favor_renter" },
      depositOperationStatus: "released" as const,
    };
    mockResolveDispute.mockResolvedValue(mockResult);

    mockParseFormData.mockResolvedValueOnce({
      outcome: "favor_renter",
      reason: "Renter provided sufficient evidence of no damage",
    });

    const { POST } = await import("../route");
    const request = new NextRequest(
      `http://localhost:3000/api/disputes/${disputeId}/resolve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: "favor_renter",
          reason: "Renter provided sufficient evidence of no damage",
        }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: disputeId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.outcome).toBe("favor_renter");
    expect(body.depositOperationStatus).toBe("released");
  });

  it("POST partial_provider with partialAmount → 200", async () => {
    const mockResult = {
      dispute: {
        id: disputeId,
        status: "resolved",
        outcome: "partial_provider",
      },
      depositOperationStatus: "captured" as const,
    };
    mockResolveDispute.mockResolvedValue(mockResult);

    mockParseFormData.mockResolvedValueOnce({
      outcome: "partial_provider",
      reason: "Partial damage confirmed, partial capture warranted",
      partialAmount: 50,
    });

    const { POST } = await import("../route");
    const request = new NextRequest(
      `http://localhost:3000/api/disputes/${disputeId}/resolve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: "partial_provider",
          reason: "Partial damage confirmed, partial capture warranted",
          partialAmount: 50,
        }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: disputeId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.outcome).toBe("partial_provider");
    expect(mockResolveDispute).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "partial_provider",
        partialAmount: 50,
      }),
    );
  });

  it("POST non-admin → 403", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue({
      userId: "user-123",
      isAdmin: false,
    });

    const { POST } = await import("../route");
    const request = new NextRequest(
      `http://localhost:3000/api/disputes/${disputeId}/resolve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: "favor_provider",
          reason: "Evidence supports provider claim for damage",
        }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: disputeId }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain("Admin");
    expect(mockResolveDispute).not.toHaveBeenCalled();
  });

  it("POST already resolved → handleApiError with ValidationError", async () => {
    mockResolveDispute.mockRejectedValue(
      new ValidationError(
        "Dispute is already resolved and cannot be resolved again",
      ),
    );

    const { POST } = await import("../route");
    const request = new NextRequest(
      `http://localhost:3000/api/disputes/${disputeId}/resolve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: "favor_provider",
          reason: "Evidence supports provider claim for damage",
        }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: disputeId }),
    });

    expect(mockHandleApiError).toHaveBeenCalledWith(
      expect.any(ValidationError),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("already resolved");
  });

  it("POST on non-existent dispute → 404", async () => {
    mockResolveDispute.mockRejectedValue(
      new NotFoundError("Dispute", "dsp_nonexistent"),
    );

    const { POST } = await import("../route");
    const request = new NextRequest(
      "http://localhost:3000/api/disputes/dsp_nonexistent/resolve",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: "favor_provider",
          reason: "Evidence supports provider claim for damage",
        }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "dsp_nonexistent" }),
    });

    expect(mockHandleApiError).toHaveBeenCalledWith(expect.any(NotFoundError));
    expect(response.status).toBe(404);
  });

  it("POST unauthenticated → 401", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const { POST } = await import("../route");
    const request = new NextRequest(
      `http://localhost:3000/api/disputes/${disputeId}/resolve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: "favor_provider",
          reason: "Evidence supports provider claim for damage",
        }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: disputeId }),
    });

    expect(response.status).toBe(401);
    expect(mockResolveDispute).not.toHaveBeenCalled();
  });
});
