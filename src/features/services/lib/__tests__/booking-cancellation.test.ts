import { describe, it, expect } from "vitest";

import {
  assessServiceCancellation,
  hoursUntilService,
  serviceInstant,
  serviceRefundBreakdown,
  serviceRefundTierFor,
  serviceTierExpiresAt,
} from "../booking-cancellation";

const BOOKING = {
  status: "accepted",
  requesterId: "requester-1",
  providerId: "provider-1",
};

describe("assessServiceCancellation", () => {
  it("lets either party cancel a pending or accepted booking", () => {
    expect(assessServiceCancellation(BOOKING, "requester-1")).toEqual({
      canCancel: true,
      cancelledBy: "requester",
      path: "accepted",
    });
    expect(
      assessServiceCancellation(
        { ...BOOKING, status: "pending" },
        "provider-1",
      ),
    ).toEqual({ canCancel: true, cancelledBy: "provider", path: "pending" });
  });

  it("refuses a stranger", () => {
    expect(assessServiceCancellation(BOOKING, "stranger-1")).toMatchObject({
      canCancel: false,
      code: "NOT_A_PARTY",
    });
  });

  it("refuses every status the action refuses", () => {
    for (const status of [
      "completed",
      "cancelled",
      "declined",
      "payment_failed",
    ]) {
      expect(
        assessServiceCancellation({ ...BOOKING, status }, "requester-1"),
      ).toMatchObject({ canCancel: false, code: "NOT_CANCELLABLE" });
    }
  });

  it("refuses while a dispute is open, with the action's own sentence", () => {
    const result = assessServiceCancellation(BOOKING, "requester-1", true);

    expect(result).toMatchObject({ canCancel: false, code: "ACTIVE_DISPUTE" });
    // The same string reaches the user from the preview and from a refusal.
    expect(result).toMatchObject({
      message:
        "Cannot cancel a booking with an active dispute. Resolve the dispute first.",
    });
  });

  it("checks membership before status, so a stranger learns nothing", () => {
    expect(
      assessServiceCancellation(
        { ...BOOKING, status: "completed" },
        "stranger-1",
      ),
    ).toMatchObject({ code: "NOT_A_PARTY" });
  });
});

describe("serviceInstant — F4, the bug this prerequisite exists to fix", () => {
  it("reads the stored wall clock in the market zone, not the server's", () => {
    // 6pm on Sep 2 in Chicago is 23:00 UTC. The old `parseProposedDateTime`
    // produced 18:00 UTC on a UTC server — five hours early, moving the
    // 24-hour refund boundary with it.
    expect(
      serviceInstant({
        proposedDate: "2026-09-02",
        proposedTime: "18:00",
      })?.toISOString(),
    ).toBe("2026-09-02T23:00:00.000Z");
  });

  it("returns null for a time it cannot read, rather than meaning now", () => {
    expect(
      serviceInstant({ proposedDate: "2026-09-02", proposedTime: "afternoon" }),
    ).toBeNull();
  });
});

describe("serviceRefundTierFor", () => {
  const eligible = (
    cancelledBy: "requester" | "provider",
    path: "pending" | "accepted" = "accepted",
  ) => ({ canCancel: true as const, cancelledBy, path });

  it("charges nothing on a pending booking, whoever cancels", () => {
    expect(
      serviceRefundTierFor(eligible("requester", "pending"), 100, false),
    ).toBe("pending_no_charge");
    expect(
      serviceRefundTierFor(eligible("provider", "pending"), 1, false),
    ).toBe("pending_no_charge");
  });

  it("makes the client whole whenever the PROVIDER cancels", () => {
    // Req 11.2.6 — timing does not enter into it.
    expect(serviceRefundTierFor(eligible("provider"), 100, true)).toBe(
      "provider_cancellation",
    );
    expect(serviceRefundTierFor(eligible("provider"), 0.5, true)).toBe(
      "provider_cancellation",
    );
  });

  it("splits the client's own cancellation on the 24-hour boundary", () => {
    expect(serviceRefundTierFor(eligible("requester"), 25, true)).toBe(
      "full_refund_24h",
    );
    expect(serviceRefundTierFor(eligible("requester"), 23, true)).toBe(
      "half_refund_under_24h",
    );
  });

  it("puts exactly 24 hours in the HALF tier, as the action does", () => {
    // `hoursUntil > 24 ? 1 : 0.5` in `cancelBooking`. Preview and action must
    // land on the same side of the boundary or the quote is a lie.
    expect(serviceRefundTierFor(eligible("requester"), 24, true)).toBe(
      "half_refund_under_24h",
    );
  });

  it("is generous, not harsh, when the job time cannot be read", () => {
    // The client is not at fault for a value the server stored, and an
    // over-refund is a better support conversation than money taken on the
    // strength of a string nobody could parse.
    expect(serviceRefundTierFor(eligible("requester"), null, true)).toBe(
      "full_refund_24h",
    );
  });

  it("reports no charge on record when an accepted booking was never charged", () => {
    expect(serviceRefundTierFor(eligible("requester"), 1, false)).toBe(
      "no_charge_on_record",
    );
  });

  it("has no tier at all for a booking that cannot be cancelled", () => {
    expect(
      serviceRefundTierFor(
        { canCancel: false, code: "NOT_CANCELLABLE", message: "" },
        100,
        true,
      ),
    ).toBe("unavailable");
  });
});

describe("serviceTierExpiresAt", () => {
  it("names the moment the quoted tier stops being true", () => {
    const serviceAt = new Date("2026-09-02T23:00:00.000Z");
    const now = new Date("2026-09-01T12:00:00.000Z");

    expect(serviceTierExpiresAt(serviceAt, now)).toBe(
      "2026-09-01T23:00:00.000Z",
    );
  });

  it("is null once the boundary has already passed", () => {
    const serviceAt = new Date("2026-09-02T23:00:00.000Z");
    const now = new Date("2026-09-02T12:00:00.000Z");

    expect(serviceTierExpiresAt(serviceAt, now)).toBeNull();
  });

  it("is null when the job time is unreadable — there is no boundary to name", () => {
    expect(serviceTierExpiresAt(null)).toBeNull();
  });
});

describe("serviceRefundBreakdown — the base changes with the tier", () => {
  const amounts = { servicePrice: "120.00", totalAmount: "124.02" };

  it("returns EVERYTHING, service fee included, on a full refund", () => {
    expect(serviceRefundBreakdown("full_refund_24h", amounts)).toMatchObject({
      refundCents: 12402,
      nonRefundableCents: 0,
      providerTransferCents: 0,
    });
  });

  it("returns half of the SERVICE PRICE — not half the total — inside 24 hours", () => {
    // The finding that makes rental copy untransferable: "50%" is half of a
    // smaller number, because the service fee is retained on this tier.
    const result = serviceRefundBreakdown("half_refund_under_24h", amounts);

    expect(result.refundCents).toBe(6000);
    expect(result.refundCents).not.toBe(Math.round(12402 * 0.5));
    expect(result.nonRefundableCents).toBe(6402);
  });

  it("moves the provider their retained share on the half tier", () => {
    // 50% retained less the platform's 20% = 30% of $120.00. Real money moving
    // on a cancellation that neither party is otherwise told about.
    expect(
      serviceRefundBreakdown("half_refund_under_24h", amounts)
        .providerTransferCents,
    ).toBe(3600);
  });

  it("transfers nothing to the provider on any other tier", () => {
    for (const tier of [
      "full_refund_24h",
      "provider_cancellation",
      "pending_no_charge",
      "no_charge_on_record",
    ] as const) {
      expect(serviceRefundBreakdown(tier, amounts).providerTransferCents).toBe(
        0,
      );
    }
  });

  it("refunds nothing, and keeps nothing, when there was never a charge", () => {
    for (const tier of ["pending_no_charge", "no_charge_on_record"] as const) {
      expect(serviceRefundBreakdown(tier, amounts)).toMatchObject({
        refundCents: 0,
        nonRefundableCents: 0,
      });
    }
  });

  it("keeps the split off floats", () => {
    const odd = { servicePrice: "33.33", totalAmount: "34.45" };
    const result = serviceRefundBreakdown("half_refund_under_24h", odd);

    expect(result.refundCents).toBe(1667);
    expect(result.refundCents + result.nonRefundableCents).toBe(3445);
  });
});

describe("hoursUntilService", () => {
  it("measures from now to the job", () => {
    expect(
      hoursUntilService(
        new Date("2026-09-02T23:00:00.000Z"),
        new Date("2026-09-02T11:00:00.000Z"),
      ),
    ).toBe(12);
  });

  it("is null when the job time cannot be read", () => {
    expect(hoursUntilService(null)).toBeNull();
  });
});
