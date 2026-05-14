import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ConflictError, ValidationError } from "@/dal/errors";

const mockGetAuthenticatedUserResponse = vi.fn();
const mockParseFormData = vi.fn();
const mockHandleApiError = vi.fn().mockImplementation((error: unknown) => {
  const err = error as { statusCode?: number; message?: string };
  return new Response(JSON.stringify({ error: err.message ?? "error" }), {
    status: err.statusCode ?? 500,
    headers: { "Content-Type": "application/json" },
  });
});

vi.mock("@/lib/api/route-helpers", () => ({
  getAuthenticatedUserResponse: (...a: any[]) =>
    mockGetAuthenticatedUserResponse(...a),
  parseFormData: (...a: any[]) => mockParseFormData(...a),
  handleApiError: (...a: any[]) => mockHandleApiError(...a),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: any[]) => any) => h,
}));

const mockSelectPrimaryCommunity = vi.fn();
vi.mock("@/features/auth/services/auth-service", () => ({
  AuthService: {
    selectPrimaryCommunity: (...a: any[]) => mockSelectPrimaryCommunity(...a),
  },
}));

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/select-community", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/select-community", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUserResponse.mockResolvedValue({ userId: "user-1" });
    mockParseFormData.mockResolvedValue({ communityId: "community-1" });
    mockSelectPrimaryCommunity.mockResolvedValue({ redirect: "/onboarding" });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthenticatedUserResponse.mockResolvedValue(
      NextResponse.json({ error: "unauth" }, { status: 401 }),
    );
    const { POST } = await import("../route");
    const res = await POST(jsonRequest({ communityId: "community-1" }));
    expect(res.status).toBe(401);
    expect(mockSelectPrimaryCommunity).not.toHaveBeenCalled();
  });

  it("returns 400 when communityId is missing", async () => {
    mockParseFormData.mockResolvedValue({});
    const { POST } = await import("../route");
    const res = await POST(jsonRequest({}));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/communityId is required/i);
    expect(mockSelectPrimaryCommunity).not.toHaveBeenCalled();
  });

  it("delegates to AuthService and returns the redirect on success", async () => {
    const { POST } = await import("../route");
    const res = await POST(jsonRequest({ communityId: "community-1" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, redirect: "/onboarding" });
    expect(mockSelectPrimaryCommunity).toHaveBeenCalledWith(
      "user-1",
      "community-1",
    );
  });

  it("maps ConflictError from the service to a 409", async () => {
    mockSelectPrimaryCommunity.mockRejectedValue(
      new ConflictError("already has a primary"),
    );
    const { POST } = await import("../route");
    const res = await POST(jsonRequest({ communityId: "community-1" }));
    expect(res.status).toBe(409);
  });

  it("maps ValidationError (inactive community) to a 400", async () => {
    mockSelectPrimaryCommunity.mockRejectedValue(
      new ValidationError("Community is not active"),
    );
    const { POST } = await import("../route");
    const res = await POST(jsonRequest({ communityId: "community-1" }));
    expect(res.status).toBe(400);
  });
});
