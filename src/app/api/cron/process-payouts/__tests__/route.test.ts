import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---
const mockProcessPayouts = vi.fn();
vi.mock("@/features/rentals/services/payment-lifecycle-service", () => ({
  PaymentLifecycleService: {
    processPayouts: (...args: unknown[]) => mockProcessPayouts(...args),
  },
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
  return new NextRequest("http://localhost:3000/api/cron/process-payouts", {
    method: "GET",
    headers,
  });
}

describe("GET /api/cron/process-payouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    mockProcessPayouts.mockResolvedValue({
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
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

  it("returns service result in response JSON", async () => {
    mockProcessPayouts.mockResolvedValue({
      processedCount: 3,
      successCount: 2,
      failureCount: 1,
    });

    const response = await GET(createCronRequest("test-cron-secret"));
    const body = await response.json();

    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        processedCount: 3,
        successCount: 2,
        failureCount: 1,
        timestamp: expect.any(String),
      }),
    );
  });

  it("returns 500 when service throws", async () => {
    mockProcessPayouts.mockRejectedValue(new Error("DB connection lost"));

    const response = await GET(createCronRequest("test-cron-secret"));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("DB connection lost");
  });
});
