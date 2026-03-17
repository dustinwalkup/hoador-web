import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockVerifyCronSecret = vi.fn();
vi.mock("@/lib/api/verify-cron-secret", () => ({
  verifyCronSecret: (req: NextRequest) => mockVerifyCronSecret(req),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: unknown) => handler,
}));

const mockRecordRun = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/admin/services/cron-run-history-service", () => ({
  CronRunHistoryService: {
    recordRun: (...args: unknown[]) => mockRecordRun(...args),
  },
}));

const mockProcessPayouts = vi.fn();
const mockScheduleDepositHolds = vi.fn();
const mockMonitorDepositExpiry = vi.fn();
vi.mock("@/features/rentals/services/payment-lifecycle-service", () => ({
  PaymentLifecycleService: {
    processPayouts: (...args: unknown[]) => mockProcessPayouts(...args),
    scheduleDepositHolds: (...args: unknown[]) =>
      mockScheduleDepositHolds(...args),
    monitorDepositExpiry: (...args: unknown[]) =>
      mockMonitorDepositExpiry(...args),
  },
}));

function createRequest(secret: string, path: string): NextRequest {
  const headers = new Headers();
  headers.set("authorization", `Bearer ${secret}`);
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "GET",
    headers,
  });
}

describe("Cron history recording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    mockVerifyCronSecret.mockReturnValue({ authorized: true });
  });

  describe("process-payouts", () => {
    it("writes history record with status success and counts on success", async () => {
      mockProcessPayouts.mockResolvedValue({
        processedCount: 5,
        successCount: 4,
        failureCount: 1,
      });

      const { GET } = await import("../process-payouts/route");
      const res = await GET(
        createRequest("test-cron-secret", "/api/cron/process-payouts"),
      );

      expect(res.status).toBe(200);
      expect(mockRecordRun).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: "process-payouts",
          status: "success",
          recordsEligible: 5,
          recordsSucceeded: 4,
          recordsFailed: 1,
        }),
      );
    });

    it("writes history record with status failure and errorMessage on throw", async () => {
      mockProcessPayouts.mockRejectedValue(new Error("DB error"));

      const { GET } = await import("../process-payouts/route");
      const res = await GET(
        createRequest("test-cron-secret", "/api/cron/process-payouts"),
      );

      expect(res.status).toBe(500);
      expect(mockRecordRun).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: "process-payouts",
          status: "failure",
          errorMessage: "DB error",
        }),
      );
    });
  });

  describe("schedule-deposit-holds", () => {
    it("writes history record on success", async () => {
      mockScheduleDepositHolds.mockResolvedValue({
        processedCount: 3,
        successCount: 2,
        failureCount: 1,
      });

      const { GET } = await import("../schedule-deposit-holds/route");
      const res = await GET(
        createRequest("test-cron-secret", "/api/cron/schedule-deposit-holds"),
      );

      expect(res.status).toBe(200);
      expect(mockRecordRun).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: "schedule-deposit-holds",
          status: "success",
          recordsEligible: 3,
          recordsSucceeded: 2,
          recordsFailed: 1,
        }),
      );
    });

    it("writes history record with status failure on throw", async () => {
      mockScheduleDepositHolds.mockRejectedValue(
        new Error("Stripe unavailable"),
      );

      const { GET } = await import("../schedule-deposit-holds/route");
      const res = await GET(
        createRequest("test-cron-secret", "/api/cron/schedule-deposit-holds"),
      );

      expect(res.status).toBe(500);
      expect(mockRecordRun).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: "schedule-deposit-holds",
          status: "failure",
          errorMessage: "Stripe unavailable",
        }),
      );
    });
  });

  describe("monitor-deposit-expiry", () => {
    it("writes history record on success", async () => {
      mockMonitorDepositExpiry.mockResolvedValue({
        checkedCount: 10,
        expiredCount: 2,
      });

      const { GET } = await import("../monitor-deposit-expiry/route");
      const res = await GET(
        createRequest("test-cron-secret", "/api/cron/monitor-deposit-expiry"),
      );

      expect(res.status).toBe(200);
      expect(mockRecordRun).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: "monitor-deposit-expiry",
          status: "success",
          recordsEligible: 10,
          recordsSucceeded: 2,
          recordsFailed: 0,
        }),
      );
    });

    it("writes history record with status failure on throw", async () => {
      mockMonitorDepositExpiry.mockRejectedValue(new Error("DB timeout"));

      const { GET } = await import("../monitor-deposit-expiry/route");
      const res = await GET(
        createRequest("test-cron-secret", "/api/cron/monitor-deposit-expiry"),
      );

      expect(res.status).toBe(500);
      expect(mockRecordRun).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: "monitor-deposit-expiry",
          status: "failure",
          errorMessage: "DB timeout",
        }),
      );
    });
  });
});
