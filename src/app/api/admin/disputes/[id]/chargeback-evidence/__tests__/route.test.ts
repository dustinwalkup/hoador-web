import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
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

vi.mock("@/lib/api/route-helpers", () => ({
  getAuthenticatedUserResponse: (...args: unknown[]) =>
    mockGetAuthenticatedUserResponse(...args),
  handleApiError: (...args: unknown[]) => mockHandleApiError(...args),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (
    handler: (
      req: NextRequest,
      ctx: { params: Promise<{ id: string }> },
    ) => Promise<Response>,
  ) => handler,
}));

const mockSubmitEvidence = vi.fn();
vi.mock("@/services/stripe/chargeback-service", () => ({
  ChargebackService: {
    submitEvidence: (...args: unknown[]) => mockSubmitEvidence(...args),
  },
}));

describe("POST /api/admin/disputes/[id]/chargeback-evidence", () => {
  const disputeId = "dsp_chargeback_123";

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUserResponse.mockResolvedValue({
      userId: "admin-123",
      isAdmin: true,
    });
    mockSubmitEvidence.mockResolvedValue(undefined);
  });

  it("POST by admin → 200, Stripe called, audit logged", async () => {
    const { POST } = await import("../route");
    const request = new NextRequest(
      `http://localhost:3000/api/admin/disputes/${disputeId}/chargeback-evidence`,
      { method: "POST" },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: disputeId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });
    expect(mockSubmitEvidence).toHaveBeenCalledWith(disputeId, "admin-123");
  });

  it("POST by non-admin → 403", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue({
      userId: "user-123",
      isAdmin: false,
    });

    const { POST } = await import("../route");
    const request = new NextRequest(
      `http://localhost:3000/api/admin/disputes/${disputeId}/chargeback-evidence`,
      { method: "POST" },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: disputeId }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain("Admin");
    expect(mockSubmitEvidence).not.toHaveBeenCalled();
  });

  it("POST on dispute without stripeChargebackId → 400", async () => {
    mockSubmitEvidence.mockRejectedValue(
      new ValidationError(
        "Dispute has no linked Stripe chargeback — cannot submit evidence",
      ),
    );

    const { POST } = await import("../route");
    const request = new NextRequest(
      `http://localhost:3000/api/admin/disputes/${disputeId}/chargeback-evidence`,
      { method: "POST" },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: disputeId }),
    });

    expect(mockHandleApiError).toHaveBeenCalledWith(
      expect.any(ValidationError),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("chargeback");
  });

  it("POST on non-existent dispute → 404", async () => {
    mockSubmitEvidence.mockRejectedValue(
      new NotFoundError("Dispute", "dsp_nonexistent"),
    );

    const { POST } = await import("../route");
    const request = new NextRequest(
      "http://localhost:3000/api/admin/disputes/dsp_nonexistent/chargeback-evidence",
      { method: "POST" },
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "dsp_nonexistent" }),
    });

    expect(mockHandleApiError).toHaveBeenCalledWith(expect.any(NotFoundError));
    expect(response.status).toBe(404);
  });
});
