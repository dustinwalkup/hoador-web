import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockProcessPayouts = vi.fn();
vi.mock("@/features/services/services/service-payout-service", () => ({
  ServicePayoutService: {
    processPayouts: (...args: unknown[]) => mockProcessPayouts(...args),
  },
}));

vi.mock("@/features/admin/services/cron-run-history-service", () => ({
  CronRunHistoryService: {
    recordRun: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockSendOpsAlert = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: (...args: unknown[]) => mockSendOpsAlert(...args),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: unknown) => handler,
}));

import { GET } from "../route";

function createCronRequest(secret?: string): NextRequest {
  const headers = new Headers();
  if (secret) {
    headers.set("authorization", `Bearer ${secret}`);
  }
  return new NextRequest(
    "http://localhost:3000/api/cron/process-service-payouts",
    {
      method: "GET",
      headers,
    },
  );
}

describe("GET /api/cron/process-service-payouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    mockProcessPayouts.mockResolvedValue({
      eligible: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
    });
  });

  it("rejects request without CRON_SECRET (401)", async () => {
    const response = await GET(createCronRequest());

    expect(response.status).toBe(401);
    expect(mockProcessPayouts).not.toHaveBeenCalled();
  });

  it("rejects request with wrong CRON_SECRET (401)", async () => {
    const response = await GET(createCronRequest("wrong-secret"));

    expect(response.status).toBe(401);
  });

  it("accepts request with valid CRON_SECRET and calls service", async () => {
    const response = await GET(createCronRequest("test-cron-secret"));

    expect(response.status).toBe(200);
    expect(mockProcessPayouts).toHaveBeenCalledWith(20);
  });

  it("returns summary counts in response JSON", async () => {
    mockProcessPayouts.mockResolvedValue({
      eligible: 5,
      processed: 4,
      succeeded: 3,
      failed: 1,
    });

    const response = await GET(createCronRequest("test-cron-secret"));
    const body = await response.json();

    expect(body).toEqual({
      processedCount: 4,
      successCount: 3,
      failureCount: 1,
    });
  });

  it("returns 500 and alerts ops when service throws", async () => {
    mockProcessPayouts.mockRejectedValue(new Error("DB connection lost"));

    const response = await GET(createCronRequest("test-cron-secret"));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("DB connection lost");
    expect(mockSendOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "process_service_payouts_cron_failed",
        message: "DB connection lost",
      }),
    );
  });
});
