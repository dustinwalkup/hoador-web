import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { NotFoundError, ValidationError } from "@/dal/errors";

const mockApplyNoShow = vi.fn();

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
  requireAdminResponse: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: vi.fn().mockResolvedValue("admin-1"),
}));

vi.mock("@/features/rentals/services/cancellation-service", () => ({
  applyNoShow: (...args: unknown[]) => mockApplyNoShow(...args),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: (req: NextRequest) => Promise<Response>) =>
    handler,
}));

describe("POST /api/admin/rentals/[id]/no-show", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAdminResponse } = await import("@/lib/api/route-helpers");
    vi.mocked(requireAdminResponse).mockResolvedValue(null);
  });

  async function postNoShow(
    id: string,
    body: { type: "renter_no_show" | "owner_no_show" },
  ) {
    const { POST } = await import("../route");
    const request = new NextRequest(
      `http://localhost:3000/api/admin/rentals/${id}/no-show`,
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      },
    );
    return POST(request, { params: Promise.resolve({ id }) });
  }

  it("returns 401 when not authenticated as admin", async () => {
    const { requireAdminResponse } = await import("@/lib/api/route-helpers");
    vi.mocked(requireAdminResponse).mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 401 }),
    );

    const { POST } = await import("../route");
    const request = new NextRequest(
      "http://localhost:3000/api/admin/rentals/req-1/no-show",
      {
        method: "POST",
        body: JSON.stringify({ type: "renter_no_show" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: "req-1" }),
    });

    expect(response.status).toBe(401);
    expect(mockApplyNoShow).not.toHaveBeenCalled();
  });

  it("returns 200 with refundAmount and ownerTransferAmount for renter_no_show", async () => {
    mockApplyNoShow.mockResolvedValue({
      success: true,
      refundAmount: 50,
      ownerTransferAmount: 30,
    });

    const response = await postNoShow("req-1", { type: "renter_no_show" });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.refundAmount).toBe(50);
    expect(data.ownerTransferAmount).toBe(30);
    expect(mockApplyNoShow).toHaveBeenCalledWith(
      "req-1",
      "renter_no_show",
      "admin-1",
    );
  });

  it("returns 200 with full refund for owner_no_show", async () => {
    mockApplyNoShow.mockResolvedValue({
      success: true,
      refundAmount: 112,
    });

    const response = await postNoShow("req-2", { type: "owner_no_show" });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.refundAmount).toBe(112);
    expect(data.ownerTransferAmount).toBeUndefined();
    expect(mockApplyNoShow).toHaveBeenCalledWith(
      "req-2",
      "owner_no_show",
      "admin-1",
    );
  });

  it("returns 400 for invalid type", async () => {
    const { POST } = await import("../route");
    const request = new NextRequest(
      "http://localhost:3000/api/admin/rentals/req-1/no-show",
      {
        method: "POST",
        body: JSON.stringify({ type: "foo" }),
        headers: { "Content-Type": "application/json" },
      },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: "req-1" }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid data");
    expect(data.details?.type).toBeDefined();
    expect(mockApplyNoShow).not.toHaveBeenCalled();
  });

  it("returns 400 for missing body", async () => {
    const { POST } = await import("../route");
    const request = new NextRequest(
      "http://localhost:3000/api/admin/rentals/req-1/no-show",
      { method: "POST" },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: "req-1" }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 400 for already cancelled rental", async () => {
    mockApplyNoShow.mockRejectedValue(
      new ValidationError("Rental is already cancelled", "status"),
    );

    const response = await postNoShow("req-cancelled", {
      type: "renter_no_show",
    });

    expect(response.status).toBe(400);
  });

  it("returns 404 for non-existent rental", async () => {
    mockApplyNoShow.mockRejectedValue(
      new NotFoundError("Rental", "req-missing"),
    );

    const response = await postNoShow("req-missing", {
      type: "owner_no_show",
    });

    expect(response.status).toBe(404);
  });
});
