import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockVerifyCronSecret = vi.fn();
vi.mock("@/lib/api/verify-cron-secret", () => ({
  verifyCronSecret: (req: NextRequest) => mockVerifyCronSecret(req),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: unknown) => handler,
}));

const mockDetectStaleProcessing = vi.fn();
vi.mock("@/features/admin/services/stale-processing-detection-service", () => ({
  StaleProcessingDetectionService: {
    detectStaleProcessing: (...args: unknown[]) =>
      mockDetectStaleProcessing(...args),
  },
}));

const mockRecordRun = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/admin/services/cron-run-history-service", () => ({
  CronRunHistoryService: {
    recordRun: (...args: unknown[]) => mockRecordRun(...args),
  },
}));

import { GET } from "../route";

function createRequest(bearerToken?: string): NextRequest {
  const headers = new Headers();
  if (bearerToken) {
    headers.set("authorization", `Bearer ${bearerToken}`);
  }
  return new NextRequest(
    "http://localhost:3000/api/cron/detect-stale-processing",
    { method: "GET", headers },
  );
}

describe("GET /api/cron/detect-stale-processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyCronSecret.mockReturnValue({ authorized: true });
    mockDetectStaleProcessing.mockResolvedValue({
      staleCount: 0,
      rentalIds: [],
      thresholdMinutes: 60,
    });
  });

  it("returns 401 without cron secret", async () => {
    mockVerifyCronSecret.mockReturnValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    });

    const res = await GET(createRequest());

    expect(res.status).toBe(401);
    expect(mockDetectStaleProcessing).not.toHaveBeenCalled();
    expect(mockRecordRun).not.toHaveBeenCalled();
  });

  it("returns 200 with valid cron secret, returns stale count and records cron history", async () => {
    mockDetectStaleProcessing.mockResolvedValue({
      staleCount: 0,
      rentalIds: [],
      thresholdMinutes: 60,
    });

    const res = await GET(createRequest("secret"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        staleCount: 0,
        rentalIds: [],
        thresholdMinutes: 60,
        timestamp: expect.any(String),
      }),
    );
    expect(mockDetectStaleProcessing).toHaveBeenCalled();
    expect(mockRecordRun).toHaveBeenCalledWith(
      expect.objectContaining({
        jobName: "detect-stale-processing",
        status: "success",
        recordsFailed: 0,
      }),
    );
  });

  it("when stale records exist, returns them and records cron history (ops alert sent by service)", async () => {
    mockDetectStaleProcessing.mockResolvedValue({
      staleCount: 2,
      rentalIds: ["r1", "r2"],
      thresholdMinutes: 60,
    });

    const res = await GET(createRequest("secret"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.staleCount).toBe(2);
    expect(body.rentalIds).toEqual(["r1", "r2"]);
    expect(mockRecordRun).toHaveBeenCalledWith(
      expect.objectContaining({
        jobName: "detect-stale-processing",
        status: "success",
        recordsFailed: 2,
        metadata: expect.stringContaining("r1"),
      }),
    );
  });

  it("returns 500 and records failed cron run when service throws", async () => {
    mockDetectStaleProcessing.mockRejectedValue(new Error("DB error"));

    const res = await GET(createRequest("secret"));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("DB error");
    expect(mockRecordRun).toHaveBeenCalledWith(
      expect.objectContaining({
        jobName: "detect-stale-processing",
        status: "failure",
        errorMessage: "DB error",
      }),
    );
  });
});
