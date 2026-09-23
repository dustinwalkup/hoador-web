import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetAnyByRentalId = vi.fn();
const mockGetAnyByServiceBookingId = vi.fn();
const mockValidateFilingWindowUnified = vi.fn();
const mockGetRentalByRequestId = vi.fn();

vi.mock("@/dal", () => ({
  disputeDAL: {
    getAnyByRentalId: (...a: unknown[]) => mockGetAnyByRentalId(...a),
    getAnyByServiceBookingId: (...a: unknown[]) =>
      mockGetAnyByServiceBookingId(...a),
    validateFilingWindowUnified: (...a: unknown[]) =>
      mockValidateFilingWindowUnified(...a),
  },
  rentalDAL: {
    getRentalByRequestId: (...a: unknown[]) => mockGetRentalByRequestId(...a),
  },
}));

const {
  rentalDisputeEligibility,
  serviceBookingDisputeEligibility,
  resolveRentalIdForDispute,
} = await import("../filing-eligibility");

const DEADLINE = new Date("2026-03-01T12:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnyByRentalId.mockResolvedValue(null);
  mockGetAnyByServiceBookingId.mockResolvedValue(null);
  mockValidateFilingWindowUnified.mockResolvedValue({
    valid: true,
    deadline: DEADLINE,
  });
});

describe("rentalDisputeEligibility", () => {
  it("offers filing inside the window with no existing dispute", async () => {
    expect(await rentalDisputeEligibility("rental-1", true)).toEqual({
      canFile: true,
      filingWindowEndsAt: DEADLINE.toISOString(),
      existingDisputeId: null,
      existingDisputeStatus: null,
    });
  });

  it("refuses a non-party without querying anything", async () => {
    expect(await rentalDisputeEligibility("rental-1", false)).toMatchObject({
      canFile: false,
      existingDisputeId: null,
    });
    expect(mockGetAnyByRentalId).not.toHaveBeenCalled();
    expect(mockValidateFilingWindowUnified).not.toHaveBeenCalled();
  });

  it("refuses when the request was never approved into a rental", async () => {
    expect(await rentalDisputeEligibility(null, true)).toMatchObject({
      canFile: false,
    });
    expect(mockGetAnyByRentalId).not.toHaveBeenCalled();
  });

  it("refuses and names an OPEN dispute", async () => {
    mockGetAnyByRentalId.mockResolvedValue({ id: "d-1", status: "open" });

    expect(await rentalDisputeEligibility("rental-1", true)).toMatchObject({
      canFile: false,
      existingDisputeId: "d-1",
      existingDisputeStatus: "open",
    });
  });

  // F19: the unique index makes it one dispute per rental *ever*. A resolved one
  // still blocks — which is exactly why the status ships alongside the id, so a
  // client can say "this is finished" rather than "go see the open one".
  it("refuses and names a RESOLVED dispute, even inside the window", async () => {
    mockGetAnyByRentalId.mockResolvedValue({ id: "d-old", status: "resolved" });

    expect(await rentalDisputeEligibility("rental-1", true)).toMatchObject({
      canFile: false,
      existingDisputeId: "d-old",
      existingDisputeStatus: "resolved",
    });
  });

  it("refuses when the window has closed, and still reports the deadline", async () => {
    mockValidateFilingWindowUnified.mockResolvedValue({
      valid: false,
      deadline: DEADLINE,
      message: "closed",
    });

    expect(await rentalDisputeEligibility("rental-1", true)).toMatchObject({
      canFile: false,
      filingWindowEndsAt: DEADLINE.toISOString(),
    });
  });

  it("reports no deadline before the rental is returned", async () => {
    // The unified window has no closing time until `returnConfirmedAt` is set —
    // it is open-ended, not expired.
    mockValidateFilingWindowUnified.mockResolvedValue({ valid: true });

    expect(await rentalDisputeEligibility("rental-1", true)).toMatchObject({
      canFile: true,
      filingWindowEndsAt: null,
    });
  });
});

describe("serviceBookingDisputeEligibility", () => {
  const booking = (over: Record<string, unknown> = {}) => ({
    id: "sb-1",
    status: "completed",
    proposedDate: "2026-02-20",
    proposedTime: "10:00",
    completedAt: new Date("2026-02-20T12:00:00Z"),
    ...over,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    // Inside the 24h window that opens on the scheduled day and closes 24h
    // after completion.
    vi.setSystemTime(new Date("2026-02-20T18:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("offers filing on a completed booking inside the window", async () => {
    const result = await serviceBookingDisputeEligibility(booking(), true);
    expect(result.canFile).toBe(true);
    expect(result.filingWindowEndsAt).toBe("2026-02-21T12:00:00.000Z");
  });

  it("offers filing on an accepted booking too", async () => {
    const result = await serviceBookingDisputeEligibility(
      booking({ status: "accepted", completedAt: null }),
      true,
    );
    expect(result.canFile).toBe(true);
  });

  // Mirrors `createServiceBookingDispute`: there is nothing to dispute about a
  // request nobody accepted.
  it.each(["pending", "declined", "cancelled", "payment_failed"])(
    "refuses a %s booking",
    async (status) => {
      const result = await serviceBookingDisputeEligibility(
        booking({ status }),
        true,
      );
      expect(result.canFile).toBe(false);
    },
  );

  it("refuses a non-party without querying anything", async () => {
    expect(
      await serviceBookingDisputeEligibility(booking(), false),
    ).toMatchObject({ canFile: false });
    expect(mockGetAnyByServiceBookingId).not.toHaveBeenCalled();
  });

  it("refuses once the window has closed", async () => {
    vi.setSystemTime(new Date("2026-02-23T00:00:00Z"));
    const result = await serviceBookingDisputeEligibility(booking(), true);
    expect(result.canFile).toBe(false);
  });

  it("refuses before the scheduled day", async () => {
    vi.setSystemTime(new Date("2026-02-18T00:00:00Z"));
    const result = await serviceBookingDisputeEligibility(
      booking({ completedAt: null, status: "accepted" }),
      true,
    );
    expect(result.canFile).toBe(false);
  });

  it("refuses and names an existing dispute", async () => {
    mockGetAnyByServiceBookingId.mockResolvedValue({
      id: "d-2",
      status: "under_review",
    });

    expect(
      await serviceBookingDisputeEligibility(booking(), true),
    ).toMatchObject({
      canFile: false,
      existingDisputeId: "d-2",
      existingDisputeStatus: "under_review",
    });
  });

  it("accepts a Date proposedDate as well as a string", async () => {
    const result = await serviceBookingDisputeEligibility(
      booking({ proposedDate: new Date("2026-02-20T00:00:00Z") }),
      true,
    );
    expect(result.canFile).toBe(true);
  });
});

describe("resolveRentalIdForDispute", () => {
  // `/api/rentals/[id]` is addressed by the REQUEST id; `blind_reviews` and
  // `disputes` hang off `rentals.id`. Confusing the two matches nothing.
  it("resolves a request id to its rental id", async () => {
    mockGetRentalByRequestId.mockResolvedValue({ id: "rental-1" });
    expect(
      await resolveRentalIdForDispute({ type: "request", id: "req-1" }),
    ).toBe("rental-1");
    expect(mockGetRentalByRequestId).toHaveBeenCalledWith("req-1");
  });

  it("returns null for a request never approved into a rental", async () => {
    mockGetRentalByRequestId.mockResolvedValue(null);
    expect(
      await resolveRentalIdForDispute({ type: "request", id: "req-1" }),
    ).toBeNull();
  });

  it("passes a rental id through untouched", async () => {
    expect(
      await resolveRentalIdForDispute({ type: "rental", id: "rental-1" }),
    ).toBe("rental-1");
    expect(mockGetRentalByRequestId).not.toHaveBeenCalled();
  });
});
