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

const mockGetUserDisputes = vi.fn();
const mockGetAdminDisputes = vi.fn();
vi.mock("@/dal", () => ({
  disputeDAL: {
    getAdminDisputes: (...args: unknown[]) => mockGetAdminDisputes(...args),
    getUserDisputes: (...args: unknown[]) => mockGetUserDisputes(...args),
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

describe("GET /api/disputes", () => {
  const listRow = {
    id: "dispute-1",
    status: "open",
    reasonCode: "damage",
    createdAt: new Date("2026-02-20T00:00:00Z"),
    rental: {
      id: "rental-1",
      requestId: "request-1",
      listingId: "listing-1",
      renterId: "user-123",
      ownerId: "user-owner",
      listing: { name: "Hammer drill" },
    },
    serviceBooking: null,
    // The join the leak lives in.
    createdByUser: {
      id: "user-owner",
      firstName: "Olive",
      lastName: "Owner",
      email: "olive@example.com",
    },
    evidence: [{ id: "ev-1" }],
  };

  const page = {
    data: [listRow],
    pagination: { page: 1, limit: 12, total: 1 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserDisputes.mockResolvedValue(page);
    mockGetAdminDisputes.mockResolvedValue(page);
    mockGetAuthenticatedUserResponse.mockResolvedValue({
      userId: "user-123",
      isAdmin: false,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } = await import("../route");
    const response = await GET(
      new NextRequest("http://localhost/api/disputes"),
    );
    expect(response.status).toBe(401);
  });

  // P-E13-2 / F23. `getUserDisputes` joins `createdByUser` including `email`,
  // so a dispute filed by the counterparty handed the viewer their address.
  it("strips the counterparty's email from a user's list", async () => {
    const { GET } = await import("../route");
    const response = await GET(
      new NextRequest("http://localhost/api/disputes"),
    );
    const body = await response.text();

    expect(body).not.toContain("olive@example.com");
    expect(JSON.parse(body).data[0]).not.toHaveProperty("createdByUser");
  });

  it("leaves the rest of the list row intact", async () => {
    const { GET } = await import("../route");
    const response = await GET(
      new NextRequest("http://localhost/api/disputes"),
    );
    const json = await response.json();

    expect(json.pagination).toMatchObject({ page: 1, total: 1 });
    expect(json.data[0]).toMatchObject({
      id: "dispute-1",
      status: "open",
      reasonCode: "damage",
      rental: { listing: { name: "Hammer drill" } },
    });
  });

  it("leaves the admin listing untouched", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue({
      userId: "user-admin",
      isAdmin: true,
    });
    const { GET } = await import("../route");
    const json = await (
      await GET(new NextRequest("http://localhost/api/disputes"))
    ).json();

    expect(json.data[0].createdByUser.email).toBe("olive@example.com");
  });
});

// ── P-E13-3: the typed errors on the wire ────────────────────────────────────
//
// The mocked `handleApiError` above only mirrors `statusCode`/`message`, so it
// cannot show what the body looks like. This block imports the real one and
// asserts the shape a client branches on: `code` alongside a human `error`,
// with the payload spread at the top level.
describe("typed dispute errors → response body", () => {
  it("maps each error class to its code, status and payload", async () => {
    const { handleApiError } = await vi.importActual<
      typeof import("@/lib/api/route-helpers")
    >("@/lib/api/route-helpers");
    const {
      DisputeAlreadyExistsError,
      DisputeRateLimitedError,
      DisputeWindowClosedError,
      EvidenceDeadlinePassedError,
      EvidenceLimitReachedError,
    } = await import("@/features/disputes/lib/dispute-errors");

    const cases = [
      {
        error: new DisputeAlreadyExistsError(
          "An active dispute already exists",
          {
            disputeId: "dispute-9",
            resolved: false,
          },
        ),
        status: 409,
        code: "DISPUTE_ALREADY_EXISTS",
        payload: { disputeId: "dispute-9", resolved: false },
      },
      {
        error: new DisputeRateLimitedError("Rate limit exceeded", {
          monthlyCount: 3,
          monthlyLimit: 3,
          yearlyCount: 4,
          yearlyLimit: 10,
        }),
        status: 429,
        code: "DISPUTE_RATE_LIMITED",
        payload: { monthlyCount: 3, monthlyLimit: 3 },
      },
      {
        error: new DisputeWindowClosedError("Filing window has expired", {
          deadline: "2026-03-01T00:00:00.000Z",
          reason: "closed" as const,
        }),
        status: 400,
        code: "DISPUTE_WINDOW_CLOSED",
        payload: { deadline: "2026-03-01T00:00:00.000Z", reason: "closed" },
      },
      {
        error: new EvidenceDeadlinePassedError(
          "Evidence deadline has expired",
          {
            deadline: "2026-03-05T00:00:00.000Z",
          },
        ),
        status: 400,
        code: "EVIDENCE_DEADLINE_PASSED",
        payload: { deadline: "2026-03-05T00:00:00.000Z" },
      },
      {
        error: new EvidenceLimitReachedError("Maximum of 10 evidence items", {
          limit: 10,
          count: 10,
        }),
        status: 422,
        code: "EVIDENCE_LIMIT_REACHED",
        payload: { limit: 10, count: 10 },
      },
    ];

    for (const testCase of cases) {
      const response = handleApiError(testCase.error);
      expect(response.status).toBe(testCase.status);

      const body = await response.json();
      expect(body).toMatchObject({ code: testCase.code, ...testCase.payload });
      // `error` stays PROSE, not the code — the web hooks throw
      // `new Error(body.error)` and would otherwise toast the code at the user.
      expect(body.error).toBe(testCase.error.message);
      expect(body.error).not.toBe(testCase.code);
    }
  });
});
