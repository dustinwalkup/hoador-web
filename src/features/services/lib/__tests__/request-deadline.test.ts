import { describe, it, expect } from "vitest";

import { serviceRequestDeadline } from "../request-deadline";

/**
 * Flow 6 (staging BK2, BK3): a request's response deadline was its 72-hour
 * expiry, so a booking made two hours before the job told the client "Dustin
 * has 2d 23h to respond", and BK2's request outlived its own 10am start.
 * Accept is refused once the scheduled Central time has passed, so that time
 * is the deadline whenever it comes first.
 */
describe("serviceRequestDeadline", () => {
  it("is the scheduled start when it comes before the 72 hours (BK2)", () => {
    const expiresAt = new Date("2026-10-27T20:24:51Z");

    expect(
      serviceRequestDeadline(expiresAt, {
        proposedDate: "2026-10-27",
        proposedTime: "10:00",
      }).toISOString(),
    ).toBe("2026-10-27T15:00:00.000Z");
  });

  it("is two hours away for a job booked two hours out (BK3)", () => {
    expect(
      serviceRequestDeadline(new Date("2026-10-27T20:44:11Z"), {
        proposedDate: "2026-10-24",
        proposedTime: "18:00",
      }).toISOString(),
    ).toBe("2026-10-24T23:00:00.000Z");
  });

  it("is the 72-hour expiry when the job is further out", () => {
    const expiresAt = new Date("2026-10-27T20:00:00Z");

    expect(
      serviceRequestDeadline(expiresAt, {
        proposedDate: "2026-11-05",
        proposedTime: "09:00",
      }),
    ).toEqual(expiresAt);
  });

  // An unreadable time is unknown, never "now" (the server lets accept through).
  it("keeps the 72-hour expiry when the stored time cannot be read", () => {
    const expiresAt = new Date("2026-10-27T20:00:00Z");

    expect(
      serviceRequestDeadline(expiresAt, {
        proposedDate: "2026-10-24",
        proposedTime: "afternoon",
      }),
    ).toEqual(expiresAt);
  });
});
