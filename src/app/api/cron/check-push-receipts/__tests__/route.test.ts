import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Requirements: 2.2.4
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.2.2
 */

const mockVerifyCronSecret = vi.fn();
vi.mock("@/lib/api/verify-cron-secret", () => ({
  verifyCronSecret: (...a: unknown[]) => mockVerifyCronSecret(...a),
}));

const mockCheckExpoPushReceipts = vi.fn();
vi.mock("@/features/notifications/lib/expo-push-service", () => ({
  checkExpoPushReceipts: (...a: unknown[]) => mockCheckExpoPushReceipts(...a),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { GET } from "../route";

const req = () =>
  new NextRequest("http://localhost/api/cron/check-push-receipts");

describe("GET /api/cron/check-push-receipts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockVerifyCronSecret.mockReturnValue({ authorized: true });
    mockCheckExpoPushReceipts.mockResolvedValue({
      checked: 3,
      ok: 2,
      errored: 1,
      deactivated: 1,
      expired: 0,
    });
  });

  it("rejects a request without a valid cron secret", async () => {
    mockVerifyCronSecret.mockReturnValue({
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const res = await GET(req());

    expect(res.status).toBe(401);
    // The check must gate the work, not just the response.
    expect(mockCheckExpoPushReceipts).not.toHaveBeenCalled();
  });

  it("returns the receipt-check summary", async () => {
    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      checked: 3,
      ok: 2,
      errored: 1,
      deactivated: 1,
    });
  });

  it("returns 500 when the receipt check throws", async () => {
    mockCheckExpoPushReceipts.mockRejectedValue(new Error("expo unreachable"));

    const res = await GET(req());

    expect(res.status).toBe(500);
    expect((await res.json()).success).toBe(false);
  });
});
