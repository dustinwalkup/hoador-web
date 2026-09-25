import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DisputeWithRelations } from "@/dal/types";

/**
 * Terminology inventory S-03: the resolution outcome names the parties by the
 * underlying transaction — owner / renter for a rental, provider / client for
 * a booking — and never "requester". The mobile app shows these notification
 * messages verbatim.
 */

const mockSendNotification = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: (...a: unknown[]) => mockSendNotification(...a),
}));

vi.mock("@/dal", () => ({
  rentalDAL: {
    getRentalDetailsById: vi.fn().mockResolvedValue({
      renterId: "renter-1",
      ownerId: "owner-1",
      renterName: "Rae Renter",
      ownerName: "Oli Owner",
      listingName: "Ladder",
    }),
  },
  serviceBookingDAL: {},
  userDAL: {
    getUserById: vi.fn(async (id: string) => ({ id, email: `${id}@x.test` })),
    getStaffNotificationRecipients: vi.fn().mockResolvedValue([]),
  },
}));

import {
  formatResolutionOutcome,
  sendDisputeNotifications,
} from "../dispute-notifications";

describe("formatResolutionOutcome", () => {
  it.each([
    ["favor_renter", "In Favor of Renter"],
    ["favor_provider", "In Favor of Owner"],
    ["partial_renter", "Partial Resolution — Favor Renter"],
    ["partial_provider", "Partial Resolution — Favor Owner"],
  ])("rental %s → %s", (outcome, label) => {
    expect(formatResolutionOutcome(outcome, "rental")).toBe(label);
  });

  it.each([
    ["favor_renter", "In Favor of Client"],
    ["favor_provider", "In Favor of Provider"],
    ["partial_renter", "Partial Resolution — Favor Client"],
    ["partial_provider", "Partial Resolution — Favor Provider"],
  ])("booking %s → %s", (outcome, label) => {
    expect(formatResolutionOutcome(outcome, "booking")).toBe(label);
  });

  it("never names a requester, or the other transaction's roles", () => {
    const outcomes = [
      "favor_renter",
      "favor_provider",
      "partial_renter",
      "partial_provider",
    ];
    for (const o of outcomes) {
      const rental = formatResolutionOutcome(o, "rental");
      const booking = formatResolutionOutcome(o, "booking");
      expect(rental).not.toMatch(/requester|provider|client/i);
      expect(booking).not.toMatch(/requester|renter|owner/i);
    }
  });
});

describe("dispute resolved notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const messages = () =>
    mockSendNotification.mock.calls.map((c) => c[0].message as string);

  it("labels a rental outcome with owner / renter", async () => {
    await sendDisputeNotifications(
      {
        id: "d-1",
        rentalId: "rental-1",
        serviceBookingId: null,
        createdBy: "renter-1",
        resolutionOutcome: "favor_provider",
        resolutionReason: "Photos show damage",
        resolvedByUser: null,
      } as unknown as DisputeWithRelations,
      "resolved",
    );

    expect(messages()).toHaveLength(2);
    for (const m of messages()) {
      expect(m).toBe(
        "The dispute for Ladder has been resolved: In Favor of Owner",
      );
    }
  });

  it("labels a booking outcome with provider / client", async () => {
    await sendDisputeNotifications(
      {
        id: "d-2",
        rentalId: null,
        serviceBookingId: "sb-1",
        createdBy: "client-1",
        createdByRole: "requester",
        resolutionOutcome: "partial_renter",
        serviceBooking: {
          requesterId: "client-1",
          providerId: "provider-1",
          listing: { title: "Lawn care" },
        },
      } as unknown as DisputeWithRelations,
      "resolved",
    );

    expect(messages()).toHaveLength(2);
    for (const m of messages()) {
      expect(m).toBe(
        "The dispute for Lawn care has been resolved: Partial Resolution — Favor Client",
      );
    }
  });
});
