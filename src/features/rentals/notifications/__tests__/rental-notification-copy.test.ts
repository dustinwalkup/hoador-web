import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * TERMINOLOGY-GUIDELINES §3.1, §4.1 and §6.2: owners accept (never approve)
 * rental requests, a request is not a rental until it is accepted, and the
 * mobile control that ends a rental is "Confirm return". This in-app and push
 * copy is shown in the mobile app word for word.
 */

const mockSendNotification = vi.fn();
vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: (...a: unknown[]) => mockSendNotification(...a),
}));

import { sendRentalApprovedNotification } from "../rental-approved";
import { sendRentalCancelledNotification } from "../rental-cancelled";
import { sendRentalEndedNotification } from "../rental-ended";
import { sendRentalStartedNotification } from "../rental-started";

const payload = () =>
  mockSendNotification.mock.calls.at(-1)?.[0] as {
    title: string;
    message: string;
    email?: { subject: string; html: string; text: string };
  };

const CANCELLED = {
  recipientUserId: "owner-1",
  recipientName: "Olive Owner",
  otherPartyName: "Riley Renter",
  listingName: "Pressure Washer",
  rentalId: "req-1",
  cancelledBy: "renter" as const,
};

describe("rental notification copy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("an accepted request says the owner accepted it, not approved it", async () => {
    await sendRentalApprovedNotification({
      userId: "renter-1",
      to: "r@example.com",
      renterName: "Riley Renter",
      ownerName: "Olive Owner",
      listingName: "Pressure Washer",
      rentalId: "req-1",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      totalAmount: "81.00",
    });

    const sent = payload();
    expect(sent.title).toBe("Rental Request Accepted!");
    expect(sent.message).toBe(
      "Olive Owner accepted your rental request for Pressure Washer",
    );
    // The email is the same template, so it inherits the same wording.
    expect(sent.email?.subject).toBe(
      "Your Rental Request Was Accepted: Pressure Washer",
    );
    expect(sent.email?.text).not.toMatch(/approved/i);
  });

  it("a cancelled request names the request", async () => {
    await sendRentalCancelledNotification({ ...CANCELLED, stage: "request" });
    expect(payload()).toMatchObject({
      title: "Rental Request Cancelled",
      message:
        "Riley Renter cancelled their rental request for Pressure Washer",
    });
  });

  it("a cancelled accepted rental names the rental", async () => {
    await sendRentalCancelledNotification({ ...CANCELLED, stage: "rental" });
    expect(payload()).toMatchObject({
      title: "Rental Cancelled",
      message: "Riley Renter cancelled the rental for Pressure Washer",
    });
  });

  it("start and return lead with the owner", async () => {
    const people = {
      userId: "renter-1",
      renterName: "Riley Renter",
      ownerName: "Olive Owner",
      listingName: "Pressure Washer",
      rentalId: "req-1",
    };

    await sendRentalStartedNotification(people);
    expect(payload()).toMatchObject({
      title: "Rental Started",
      message: "Olive Owner started your rental of Pressure Washer.",
    });

    await sendRentalEndedNotification(people);
    expect(payload()).toMatchObject({
      title: "Rental Completed",
      message:
        "Olive Owner confirmed the return of Pressure Washer. Please leave a review!",
    });
  });
});
