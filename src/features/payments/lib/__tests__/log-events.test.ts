import { describe, it, expect, vi, beforeEach } from "vitest";

const infoMock = vi.fn();

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({
    info: infoMock,
  }),
}));

import { logGatingEvent } from "../log-events";

describe("logGatingEvent", () => {
  beforeEach(() => {
    infoMock.mockClear();
  });

  it("emits an info log with the event name as both a field and the message", () => {
    logGatingEvent("listing_created_without_stripe_connect", {
      userId: "user-1",
      listingId: "listing-99",
      onboardingStatus: "not_started",
    });

    expect(infoMock).toHaveBeenCalledTimes(1);
    const [merge, msg] = infoMock.mock.calls[0]!;
    expect(merge).toEqual({
      event: "listing_created_without_stripe_connect",
      userId: "user-1",
      listingId: "listing-99",
      onboardingStatus: "not_started",
    });
    expect(msg).toBe("listing_created_without_stripe_connect");
  });

  it("includes bookingType and bookingId when provided", () => {
    logGatingEvent("accept_blocked_payment_setup_required", {
      userId: "user-2",
      bookingType: "rental",
      bookingId: "rental-42",
      onboardingStatus: "restricted",
    });

    const [merge] = infoMock.mock.calls[0]!;
    expect(merge).toMatchObject({
      event: "accept_blocked_payment_setup_required",
      bookingType: "rental",
      bookingId: "rental-42",
      onboardingStatus: "restricted",
    });
  });

  it("allows arbitrary extra properties", () => {
    logGatingEvent("accept_blocked_payment_setup_required", {
      userId: "user-3",
      regression: true,
      reason: "stripe_unreachable",
    });

    const [merge] = infoMock.mock.calls[0]!;
    expect(merge).toMatchObject({
      regression: true,
      reason: "stripe_unreachable",
    });
  });
});
