import { test, expect } from "@playwright/test";

/**
 * UAT-SVC-52: Cron endpoint rejects requests without CRON_SECRET
 * (Stripe / payout processing is not invoked for 401 responses.)
 */
test.describe("UAT-SVC-52: GET /api/cron/process-service-payouts authorization", () => {
  test("returns 401 when Authorization header is missing", async ({
    request,
  }) => {
    const response = await request.get("/api/cron/process-service-payouts");
    expect(response.status()).toBe(401);
  });

  test("returns 401 when Bearer token is incorrect", async ({ request }) => {
    const response = await request.get("/api/cron/process-service-payouts", {
      headers: { Authorization: "Bearer incorrect-cron-secret-for-e2e" },
    });
    expect(response.status()).toBe(401);
  });

  test("returns 200 when CRON_SECRET matches (if set in test env)", async ({
    request,
  }) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      test.skip();
      return;
    }

    const response = await request.get("/api/cron/process-service-payouts", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      processedCount: expect.any(Number),
      successCount: expect.any(Number),
      failureCount: expect.any(Number),
    });
  });
});
