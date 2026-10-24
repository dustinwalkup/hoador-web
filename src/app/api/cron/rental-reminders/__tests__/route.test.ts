import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api/verify-cron-secret", () => ({
  verifyCronSecret: () => ({ authorized: true }),
}));
vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: unknown) => handler,
}));

const mockGetReminders = vi.fn();
vi.mock("@/dal", () => ({
  rentalDAL: {
    getApprovedRentalsForDailyReminders: (...a: unknown[]) =>
      mockGetReminders(...a),
  },
}));
vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: vi.fn().mockResolvedValue({ success: true }),
}));

import { GET } from "../route";

const req = () =>
  new NextRequest("http://localhost:3000/api/cron/rental-reminders");

/**
 * HOA-124: "starts today" is the Central calendar day. The workflow runs this
 * at 10:00 UTC, when the UTC and Central days agree; a run at any other hour
 * (a manual trigger, a moved schedule) asked the server's UTC day instead.
 */
describe("GET /api/cron/rental-reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetReminders.mockResolvedValue([]);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks for the Central day, not the server's UTC day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 8pm on Oct 26 in Chicago, already Oct 27 in UTC.
    vi.setSystemTime(new Date("2026-10-27T01:00:00Z"));

    await GET(req());

    // Midnight on Oct 26, in the shape a stored booked day has.
    expect(mockGetReminders).toHaveBeenCalledWith(new Date(2026, 9, 26));
  });
});
