import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const sweepMock = vi.fn();
const recordRunMock = vi.fn();
const opsAlertMock = vi.fn();

vi.mock("@/features/disputes/services/evidence-deadline-sweep", () => ({
  runEvidenceDeadlineSweep: (...args: unknown[]) => sweepMock(...args),
}));

vi.mock("@/features/admin/services/cron-run-history-service", () => ({
  CronRunHistoryService: {
    recordRun: (...args: unknown[]) => recordRunMock(...args),
  },
}));

vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: (...args: unknown[]) => opsAlertMock(...args),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: unknown) => handler,
}));

import { GET } from "../route";

function createCronRequest(secret?: string): NextRequest {
  const headers = new Headers();
  if (secret) headers.set("authorization", `Bearer ${secret}`);
  return new NextRequest("http://localhost:3000/api/cron/evidence-deadlines", {
    method: "GET",
    headers,
  });
}

const RESULT = {
  remindersEligible: 3,
  remindersSent: 2,
  remindersFailed: 1,
  expiredEligible: 2,
  expiredEnforced: 2,
  expiredFailed: 0,
};

describe("GET /api/cron/evidence-deadlines (P-E13-9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.CRON_SECRET = "test-cron-secret";
    sweepMock.mockResolvedValue(RESULT);
    recordRunMock.mockResolvedValue(undefined);
    opsAlertMock.mockResolvedValue(undefined);
  });

  it("rejects requests without the CRON_SECRET (401)", async () => {
    const response = await GET(createCronRequest());
    expect(response.status).toBe(401);
    expect(sweepMock).not.toHaveBeenCalled();
  });

  it("rejects requests with the wrong CRON_SECRET (401)", async () => {
    const response = await GET(createCronRequest("nope"));
    expect(response.status).toBe(401);
    expect(sweepMock).not.toHaveBeenCalled();
  });

  it("runs the sweep and reports both passes", async () => {
    const response = await GET(createCronRequest("test-cron-secret"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        success: true,
        ...RESULT,
        timestamp: expect.any(String),
      }),
    );
    expect(sweepMock).toHaveBeenCalledWith(expect.any(Date));
    expect(recordRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobName: "evidence-deadlines",
        status: "success",
        recordsEligible: 5,
        recordsSucceeded: 4,
        recordsFailed: 1,
      }),
    );
  });

  it("returns 500, records the failure and alerts ops when the sweep throws", async () => {
    sweepMock.mockRejectedValue(new Error("db down"));

    const response = await GET(createCronRequest("test-cron-secret"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: "db down" });
    expect(recordRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobName: "evidence-deadlines",
        status: "failure",
        errorMessage: "db down",
      }),
    );
    expect(opsAlertMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: "evidence-deadlines-cron-failure" }),
    );
  });
});
