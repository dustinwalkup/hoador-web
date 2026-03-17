import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ValidationError, ConflictError } from "@/dal/errors";

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
const mockGetClientIP = vi.fn().mockReturnValue("127.0.0.1");
const mockGetUserAgent = vi.fn().mockReturnValue("test-agent");

vi.mock("@/lib/api/route-helpers", () => ({
  getAuthenticatedUserResponse: (...args: unknown[]) =>
    mockGetAuthenticatedUserResponse(...args),
  handleApiError: (...args: unknown[]) => mockHandleApiError(...args),
  parseFormData: (...args: unknown[]) => mockParseFormData(...args),
  getClientIP: (...args: unknown[]) => mockGetClientIP(...args),
  getUserAgent: (...args: unknown[]) => mockGetUserAgent(...args),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: (req: NextRequest) => Promise<Response>) =>
    handler,
}));

const mockCreateDispute = vi.fn();
vi.mock("@/features/disputes/services/dispute-creation-service", () => ({
  DisputeCreationService: {
    createDispute: (...args: unknown[]) => mockCreateDispute(...args),
  },
}));

vi.mock("@/dal", () => ({
  disputeDAL: {
    getAdminDisputes: vi.fn(),
    getUserDisputes: vi.fn(),
    getActiveByRentalId: vi.fn(),
  },
}));

describe("POST /api/disputes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUserResponse.mockResolvedValue({
      userId: "user-123",
      isAdmin: false,
    });
    mockParseFormData.mockResolvedValue({
      rentalId: "550e8400-e29b-41d4-a716-446655440000",
      reasonCode: "damage",
      description: "Tool was damaged during rental period",
    });
  });

  it("POST successful → 201, dispute returned", async () => {
    const mockDispute = {
      id: "dsp_123",
      rentalId: "550e8400-e29b-41d4-a716-446655440000",
      reasonCode: "damage",
      status: "open",
    };
    mockCreateDispute.mockResolvedValue({ dispute: mockDispute });

    const { POST } = await import("../route");
    const request = new NextRequest("http://localhost:3000/api/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rentalId: "550e8400-e29b-41d4-a716-446655440000",
        reasonCode: "damage",
        description: "Tool was damaged during rental period",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual(mockDispute);
    expect(mockCreateDispute).toHaveBeenCalledWith(
      expect.objectContaining({
        rentalId: "550e8400-e29b-41d4-a716-446655440000",
        reasonCode: "damage",
        description: "Tool was damaged during rental period",
        userId: "user-123",
      }),
    );
  });

  it("POST filing window expired → handleApiError called with ValidationError", async () => {
    mockCreateDispute.mockRejectedValue(
      new ValidationError("Filing window has expired"),
    );

    const { POST } = await import("../route");
    const request = new NextRequest("http://localhost:3000/api/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rentalId: "550e8400-e29b-41d4-a716-446655440000",
        reasonCode: "damage",
        description: "Tool was damaged during rental period",
      }),
    });

    const response = await POST(request);

    expect(mockHandleApiError).toHaveBeenCalledWith(
      expect.any(ValidationError),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Filing window");
  });

  it("POST unauthorized → 401 from getAuthenticatedUserResponse", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(
      NextResponse.json({ error: "Session expired" }, { status: 401 }),
    );

    const { POST } = await import("../route");
    const request = new NextRequest("http://localhost:3000/api/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rentalId: "550e8400-e29b-41d4-a716-446655440000",
        reasonCode: "damage",
        description: "Tool was damaged during rental period",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mockCreateDispute).not.toHaveBeenCalled();
  });

  it("POST active dispute exists → handleApiError called with ConflictError", async () => {
    mockCreateDispute.mockRejectedValue(
      new ConflictError("An active dispute already exists for this rental"),
    );

    const { POST } = await import("../route");
    const request = new NextRequest("http://localhost:3000/api/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rentalId: "550e8400-e29b-41d4-a716-446655440000",
        reasonCode: "damage",
        description: "Tool was damaged during rental period",
      }),
    });

    const response = await POST(request);

    expect(mockHandleApiError).toHaveBeenCalledWith(expect.any(ConflictError));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("active dispute");
  });

  it("POST with invalid data → 400", async () => {
    mockParseFormData.mockResolvedValueOnce({
      rentalId: "not-a-uuid",
      reasonCode: "damage",
      description: "short",
    });

    const { POST } = await import("../route");
    const request = new NextRequest("http://localhost:3000/api/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rentalId: "not-a-uuid",
        reasonCode: "damage",
        description: "short",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(mockCreateDispute).not.toHaveBeenCalled();
  });

  it("POST no-show reason code accepted (renter_no_show in body)", async () => {
    mockParseFormData.mockResolvedValueOnce({
      rentalId: "550e8400-e29b-41d4-a716-446655440000",
      reasonCode: "renter_no_show",
      description: "Renter did not show up for pickup",
    });
    const mockDispute = {
      id: "dsp_456",
      rentalId: "550e8400-e29b-41d4-a716-446655440000",
      reasonCode: "renter_no_show",
      status: "open",
    };
    mockCreateDispute.mockResolvedValue({ dispute: mockDispute });

    const { POST } = await import("../route");
    const request = new NextRequest("http://localhost:3000/api/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rentalId: "550e8400-e29b-41d4-a716-446655440000",
        reasonCode: "renter_no_show",
        description: "Renter did not show up for pickup",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.reasonCode).toBe("renter_no_show");
    expect(mockCreateDispute).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonCode: "renter_no_show",
      }),
    );
  });
});
