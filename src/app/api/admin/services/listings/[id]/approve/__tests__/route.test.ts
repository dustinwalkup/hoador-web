import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: unknown) => handler,
}));

vi.mock("@/lib/api/route-helpers", () => ({
  handleApiError: (err: unknown) => {
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  },
  requireAdminResponse: vi.fn(),
  parseFormData: vi.fn(),
  getCurrentUserId: vi.fn(),
}));

vi.mock("@/features/services/services/service-listing-service", () => ({
  ServiceListingService: {
    approveListing: vi.fn(),
  },
}));

import { POST } from "../route";

describe("POST /api/admin/services/listings/[id]/approve", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAdminResponse, parseFormData, getCurrentUserId } =
      await import("@/lib/api/route-helpers");
    vi.mocked(requireAdminResponse).mockResolvedValue(null);
    vi.mocked(parseFormData).mockResolvedValue({});
    vi.mocked(getCurrentUserId).mockResolvedValue("admin-1");
  });

  it("returns 403 when caller is not admin", async () => {
    const { requireAdminResponse } = await import("@/lib/api/route-helpers");
    vi.mocked(requireAdminResponse).mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );

    const res = await POST(
      new NextRequest(
        "http://localhost:3000/api/admin/services/listings/x/approve",
        {
          method: "POST",
        },
      ),
      { params: Promise.resolve({ id: "list-1" }) },
    );

    expect(res.status).toBe(403);
  });
});
