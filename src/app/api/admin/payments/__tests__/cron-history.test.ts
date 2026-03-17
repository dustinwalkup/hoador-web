import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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

const mockGetRecentRuns = vi.fn();

vi.mock("@/features/admin/services/cron-run-history-service", () => ({
  CronRunHistoryService: {
    getRecentRuns: (...args: unknown[]) => mockGetRecentRuns(...args),
  },
}));

describe("GET /api/admin/payments/cron-history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminResponse.mockResolvedValue(null);
  });

  it("returns recent runs when admin", async () => {
    const runs = [
      {
        id: "1",
        jobName: "process-payouts",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        status: "success",
        recordsEligible: 5,
        recordsSucceeded: 5,
        recordsFailed: 0,
        errorMessage: null,
        metadata: null,
        createdAt: new Date().toISOString(),
      },
    ];
    mockGetRecentRuns.mockResolvedValue(runs);

    const { GET } = await import("../cron-history/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/cron-history",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(runs);
    expect(mockGetRecentRuns).toHaveBeenCalledWith(undefined, 50);
  });

  it("filters by job name when jobName query provided", async () => {
    mockGetRecentRuns.mockResolvedValue([]);

    const { GET } = await import("../cron-history/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/cron-history?jobName=detect-stale-processing&limit=25",
    );
    await GET(req);

    expect(mockGetRecentRuns).toHaveBeenCalledWith(
      "detect-stale-processing",
      25,
    );
  });

  it("returns 403 when non-admin", async () => {
    mockRequireAdminResponse.mockResolvedValue(
      new Response(JSON.stringify({ error: "Admin privileges required" }), {
        status: 403,
      }),
    );

    const { GET } = await import("../cron-history/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/cron-history",
    );
    const res = await GET(req);

    expect(res.status).toBe(403);
    expect(mockGetRecentRuns).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAdminResponse.mockResolvedValue(
      new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
      }),
    );

    const { GET } = await import("../cron-history/route");
    const req = new NextRequest(
      "http://localhost:3000/api/admin/payments/cron-history",
    );
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(mockGetRecentRuns).not.toHaveBeenCalled();
  });
});
