import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const expirePendingBookingsMock = vi.fn();
const recordRunMock = vi.fn();

vi.mock("@/features/payments/lib/expire-pending-bookings", () => ({
  expirePendingBookings: (...args: unknown[]) =>
    expirePendingBookingsMock(...args),
}));

vi.mock("@/features/admin/services/cron-run-history-service", () => ({
  CronRunHistoryService: {
    recordRun: (...args: unknown[]) => recordRunMock(...args),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: unknown) => handler,
}));

import { GET } from "../route";

function createCronRequest(secret?: string): NextRequest {
  const headers = new Headers();
  if (secret) headers.set("authorization", `Bearer ${secret}`);
  return new NextRequest(
    "http://localhost:3000/api/cron/expire-pending-bookings",
    { method: "GET", headers },
  );
}

describe("GET /api/cron/expire-pending-bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    expirePendingBookingsMock.mockResolvedValue({
      rentalsChecked: 0,
      servicesChecked: 0,
      expiredCount: 0,
      failedCount: 0,
    });
    recordRunMock.mockResolvedValue(undefined);
  });

  it("rejects requests without the CRON_SECRET (401)", async () => {
    const response = await GET(createCronRequest());
    expect(response.status).toBe(401);
    expect(expirePendingBookingsMock).not.toHaveBeenCalled();
  });

  it("rejects requests with the wrong CRON_SECRET (401)", async () => {
    const response = await GET(createCronRequest("nope"));
    expect(response.status).toBe(401);
  });

  it("invokes the service and returns its counts in the response body", async () => {
    expirePendingBookingsMock.mockResolvedValue({
      rentalsChecked: 3,
      servicesChecked: 2,
      expiredCount: 4,
      failedCount: 1,
    });

    const response = await GET(createCronRequest("test-cron-secret"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        rentalsChecked: 3,
        servicesChecked: 2,
        expiredCount: 4,
        failedCount: 1,
        timestamp: expect.any(String),
      }),
    );
    expect(recordRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobName: "expire-pending-bookings",
        status: "success",
        recordsEligible: 5,
        recordsSucceeded: 4,
        recordsFailed: 1,
      }),
    );
  });

  it("returns 500 and records a failure run when the service throws", async () => {
    expirePendingBookingsMock.mockRejectedValue(new Error("db down"));

    const response = await GET(createCronRequest("test-cron-secret"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("db down");
    expect(recordRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobName: "expire-pending-bookings",
        status: "failure",
        errorMessage: "db down",
      }),
    );
  });
});
