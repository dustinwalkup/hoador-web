import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ForbiddenError, ValidationError } from "@/dal/errors";

// ── route-helpers mock ────────────────────────────────────────────────────────

const mockGetAuthenticatedUserResponse = vi.fn();
const mockHandleApiError = vi.fn((err: unknown) => {
  const e = err as { statusCode?: number; message?: string };
  return NextResponse.json(
    { error: e.message ?? "Internal error" },
    { status: e.statusCode ?? 500 },
  );
});

vi.mock("@/lib/api/route-helpers", () => ({
  getAuthenticatedUserResponse: (...a: unknown[]) =>
    mockGetAuthenticatedUserResponse(...a),
  handleApiError: (err: unknown) => mockHandleApiError(err),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: vi.fn().mockResolvedValue("user-1"),
}));

// ── service mock ──────────────────────────────────────────────────────────────

const mockCloseNeed = vi.fn();

vi.mock(
  "@/features/neighborhood-needs/services/neighborhood-needs-service",
  () => ({
    closeNeed: (...a: unknown[]) => mockCloseNeed(...a),
  }),
);

// ── fixtures ──────────────────────────────────────────────────────────────────

const AUTH_OWNER = { userId: "user-1", isAdmin: false, user: {} };
const AUTH_OTHER = { userId: "user-2", isAdmin: false, user: {} };
const AUTH_ADMIN = { userId: "admin-1", isAdmin: true, user: {} };

const OPEN_NEED = {
  id: "need-1",
  createdByUserId: "user-1",
  status: "open",
};
const CLOSED_NEED = { ...OPEN_NEED, status: "closed", closeReason: "manual" };

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function postClose(id: string) {
  return new NextRequest(`http://localhost/api/needs/${id}/close`, {
    method: "POST",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthenticatedUserResponse.mockResolvedValue(AUTH_OWNER);
  mockCloseNeed.mockResolvedValue(CLOSED_NEED);
});

describe("POST /api/needs/[id]/close", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { POST } = await import("../route");
    const res = await POST(postClose("need-1"), params("need-1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when non-owner tries to close", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(AUTH_OTHER);
    mockCloseNeed.mockRejectedValue(new ForbiddenError("Forbidden"));
    const { POST } = await import("../route");
    const res = await POST(postClose("need-1"), params("need-1"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with closed need for the owner", async () => {
    const { POST } = await import("../route");
    const res = await POST(postClose("need-1"), params("need-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("closed");
    expect(mockCloseNeed).toHaveBeenCalledWith("need-1", {
      userId: "user-1",
      isAdmin: false,
    });
  });

  it("is idempotent — already-closed need returns 200", async () => {
    mockCloseNeed.mockResolvedValue(CLOSED_NEED);
    const { POST } = await import("../route");
    const res1 = await POST(postClose("need-1"), params("need-1"));
    const res2 = await POST(postClose("need-1"), params("need-1"));
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it("allows admin to close any need", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(AUTH_ADMIN);
    mockCloseNeed.mockResolvedValue({ ...CLOSED_NEED, closeReason: "admin" });
    const { POST } = await import("../route");
    const res = await POST(postClose("need-1"), params("need-1"));
    expect(res.status).toBe(200);
    expect(mockCloseNeed).toHaveBeenCalledWith("need-1", {
      userId: "admin-1",
      isAdmin: true,
    });
  });

  it("returns 400 when need does not exist", async () => {
    mockCloseNeed.mockRejectedValue(
      new ValidationError("Neighborhood Need not found."),
    );
    const { POST } = await import("../route");
    const res = await POST(postClose("missing"), params("missing"));
    expect(res.status).toBe(400);
  });
});
