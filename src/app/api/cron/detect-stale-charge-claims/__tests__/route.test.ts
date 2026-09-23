import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockVerifyCronSecret = vi.fn();
vi.mock("@/lib/api/verify-cron-secret", () => ({
  verifyCronSecret: (req: NextRequest) => mockVerifyCronSecret(req),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: unknown) => handler,
}));

const mockDetectStaleChargeClaims = vi.fn();
vi.mock("@/features/admin/services/stale-processing-detection-service", () => ({
  StaleProcessingDetectionService: {
    detectStaleChargeClaims: (...args: unknown[]) =>
      mockDetectStaleChargeClaims(...args),
  },
}));

const mockRecordRun = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/admin/services/cron-run-history-service", () => ({
  CronRunHistoryService: {
    recordRun: (...args: unknown[]) => mockRecordRun(...args),
  },
}));

const mockSendOpsAlert = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: (...args: unknown[]) => mockSendOpsAlert(...args),
}));

import { GET } from "../route";

function createRequest(bearerToken?: string): NextRequest {
  const headers = new Headers();
  if (bearerToken) {
    headers.set("authorization", `Bearer ${bearerToken}`);
  }
  return new NextRequest(
    "http://localhost:3000/api/cron/detect-stale-charge-claims",
    { method: "GET", headers },
  );
}

const noneStale = {
  staleCount: 0,
  rentalRequestIds: [],
  serviceBookingIds: [],
  thresholdMinutes: 15,
};

describe("GET /api/cron/detect-stale-charge-claims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockVerifyCronSecret.mockReturnValue({ authorized: true });
    mockDetectStaleChargeClaims.mockResolvedValue(noneStale);
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
    expect(mockDetectStaleChargeClaims).not.toHaveBeenCalled();
    expect(mockRecordRun).not.toHaveBeenCalled();
  });

  it("returns 200 and records a clean run when nothing is stuck", async () => {
    const res = await GET(createRequest("secret"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(
      expect.objectContaining({
        success: true,
        staleCount: 0,
        rentalRequestIds: [],
        serviceBookingIds: [],
        thresholdMinutes: 15,
        timestamp: expect.any(String),
      }),
    );
    expect(mockRecordRun).toHaveBeenCalledWith(
      expect.objectContaining({
        jobName: "detect-stale-charge-claims",
        status: "success",
        recordsFailed: 0,
        metadata: null,
      }),
    );
  });

  it("returns stuck ids and records them in cron history (ops alert sent by service)", async () => {
    mockDetectStaleChargeClaims.mockResolvedValue({
      staleCount: 2,
      rentalRequestIds: ["req-1"],
      serviceBookingIds: ["book-1"],
      thresholdMinutes: 15,
    });

    const res = await GET(createRequest("secret"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rentalRequestIds).toEqual(["req-1"]);
    expect(body.serviceBookingIds).toEqual(["book-1"]);
    expect(mockRecordRun).toHaveBeenCalledWith(
      expect.objectContaining({
        jobName: "detect-stale-charge-claims",
        status: "success",
        recordsFailed: 2,
        metadata: JSON.stringify({
          rentalRequestIds: ["req-1"],
          serviceBookingIds: ["book-1"],
        }),
      }),
    );
  });

  it("returns 500, records the failure and alerts ops when detection throws", async () => {
    mockDetectStaleChargeClaims.mockRejectedValue(new Error("DB error"));

    const res = await GET(createRequest("secret"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: "DB error" });
    expect(mockRecordRun).toHaveBeenCalledWith(
      expect.objectContaining({
        jobName: "detect-stale-charge-claims",
        status: "failure",
        errorMessage: "DB error",
      }),
    );
    expect(mockSendOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "detect_stale_charge_claims_cron_failed",
      }),
    );
  });
});
