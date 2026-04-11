import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { NotFoundError, ForbiddenError, ValidationError } from "@/dal/errors";

const mockCancelRental = vi.fn();

vi.mock("@/lib/api/route-helpers", () => ({
  handleApiError: vi.fn((err: unknown) => {
    if (err instanceof Error) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }),
  requireAuthResponse: vi.fn().mockResolvedValue(null),
  getClientIP: vi.fn().mockReturnValue(null),
  getUserAgent: vi.fn().mockReturnValue(null),
  parseFormData: vi
    .fn()
    .mockResolvedValue({ reason: "Test cancellation reason" }),
}));

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: vi.fn().mockResolvedValue("renter-1"),
}));

vi.mock("@/features/rentals/services/cancellation-service", () => ({
  cancelRental: (...args: unknown[]) => mockCancelRental(...args),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: (req: NextRequest) => Promise<Response>) =>
    handler,
}));

describe("POST /api/rentals/[id]/cancel", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuthResponse } = await import("@/lib/api/route-helpers");
    vi.mocked(requireAuthResponse).mockResolvedValue(null);
    const { getCurrentUserId } = await import("@/features/auth/utils/session");
    vi.mocked(getCurrentUserId).mockResolvedValue("renter-1");
  });

  async function postCancel(
    id: string,
    userId?: string,
    body?: { reason?: string },
  ) {
    if (userId !== undefined) {
      const { getCurrentUserId } =
        await import("@/features/auth/utils/session");
      vi.mocked(getCurrentUserId).mockResolvedValue(userId);
    }

    const { parseFormData } = await import("@/lib/api/route-helpers");
    vi.mocked(parseFormData).mockResolvedValue(
      body ?? { reason: "Test cancellation reason" },
    );

    const { POST } = await import("../route");
    const request = new NextRequest(
      `http://localhost:3000/api/rentals/${id}/cancel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? { reason: "Test cancellation reason" }),
      },
    );
    return POST(request, { params: Promise.resolve({ id }) });
  }

  it("returns 401 when not authenticated", async () => {
    const { requireAuthResponse } = await import("@/lib/api/route-helpers");
    vi.mocked(requireAuthResponse).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const { POST } = await import("../route");
    const request = new NextRequest(
      "http://localhost:3000/api/rentals/req-1/cancel",
      { method: "POST" },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: "req-1" }),
    });

    expect(response.status).toBe(401);
    expect(mockCancelRental).not.toHaveBeenCalled();
  });

  it("returns 200 with success for pending cancel (no refund)", async () => {
    mockCancelRental.mockResolvedValue({ success: true });

    const response = await postCancel("req-1");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(mockCancelRental).toHaveBeenCalledWith(
      "req-1",
      "renter-1",
      expect.objectContaining({
        reason: "Test cancellation reason",
      }),
    );
  });

  it("returns 200 with refundAmount for approved renter cancel (≥24h)", async () => {
    mockCancelRental.mockResolvedValue({
      success: true,
      refundAmount: 100,
    });

    const response = await postCancel("req-2");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.refundAmount).toBe(100);
  });

  it("returns 200 with refundAmount and ownerTransferAmount for approved renter cancel (<24h)", async () => {
    mockCancelRental.mockResolvedValue({
      success: true,
      refundAmount: 50,
      ownerTransferAmount: 30,
    });

    const response = await postCancel("req-3");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.refundAmount).toBe(50);
    expect(body.ownerTransferAmount).toBe(30);
  });

  it("returns 200 for owner cancel with full refund", async () => {
    mockCancelRental.mockResolvedValue({
      success: true,
      refundAmount: 112,
    });

    const response = await postCancel("req-4", "owner-1");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.refundAmount).toBe(112);
  });

  it("returns 422 when cancellation service reports refund or business failure", async () => {
    mockCancelRental.mockResolvedValue({
      success: false,
      error: "Refund amount is greater than charge amount",
    });

    const response = await postCancel("req-fail");

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toContain("greater than charge");
  });

  it("returns 400 for active rental", async () => {
    mockCancelRental.mockRejectedValue(
      new ValidationError(
        "Cancellation not allowed for active rentals",
        "status",
      ),
    );

    const response = await postCancel("req-active");

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("active");
  });

  it("returns 403 when caller is not renter or owner", async () => {
    mockCancelRental.mockRejectedValue(
      new ForbiddenError("You are not authorized to cancel this rental"),
    );

    const response = await postCancel("req-1", "other-user");

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("returns 404 for non-existent rental", async () => {
    mockCancelRental.mockRejectedValue(
      new NotFoundError("Rental request", "req-missing"),
    );

    const response = await postCancel("req-missing");

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for already cancelled", async () => {
    mockCancelRental.mockRejectedValue(
      new ValidationError(
        "Rental cannot be cancelled in its current status",
        "status",
      ),
    );

    const response = await postCancel("req-cancelled");

    expect(response.status).toBe(400);
  });

  it("returns 400 when reason is missing", async () => {
    const { parseFormData } = await import("@/lib/api/route-helpers");
    vi.mocked(parseFormData).mockResolvedValueOnce({});

    const { POST } = await import("../route");
    const request = new NextRequest(
      "http://localhost:3000/api/rentals/req-1/cancel",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: "req-1" }),
    });

    expect(response.status).toBe(400);
    const resBody = await response.json();
    expect(resBody.error).toBeDefined();
    expect(
      resBody.error.match(/reason|required|expected string|invalid/i),
    ).toBeTruthy();
    expect(mockCancelRental).not.toHaveBeenCalled();
  });

  it("returns 400 when reason is empty string", async () => {
    const { parseFormData } = await import("@/lib/api/route-helpers");
    vi.mocked(parseFormData).mockResolvedValueOnce({ reason: "" });

    const { POST } = await import("../route");
    const request = new NextRequest(
      "http://localhost:3000/api/rentals/req-1/cancel",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "" }),
      },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: "req-1" }),
    });

    expect(response.status).toBe(400);
    expect(mockCancelRental).not.toHaveBeenCalled();
  });
});
