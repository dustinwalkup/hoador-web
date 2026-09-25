import { describe, it, expect, vi, beforeEach } from "vitest";

/** SEC-12: user-controlled text is escaped before it reaches email HTML. */

const mockSendNotification = vi.fn();
vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: (...a: unknown[]) => mockSendNotification(...a),
}));

import { sendRentalRequestCreatedNotification } from "../rental-request-created";
import { sendRentalDeniedNotification } from "../rental-denied";

const POISON = '<a href="https://evil.example">Verify payout</a>';
const html = () => mockSendNotification.mock.calls[0][0].email.html as string;

describe("rental emails escape user text (SEC-12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rental request created: names and listing", async () => {
    await sendRentalRequestCreatedNotification({
      userId: "owner-1",
      to: "o@example.com",
      ownerName: POISON,
      renterName: POISON,
      listingName: POISON,
      rentalId: "r-1",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      totalAmount: "81.00",
    });

    expect(html()).not.toContain('<a href="https://evil.example"');
  });

  it("rental denied: names, listing and the owner's free-text reason", async () => {
    await sendRentalDeniedNotification({
      userId: "renter-1",
      to: "r@example.com",
      renterName: POISON,
      ownerName: POISON,
      listingName: POISON,
      rentalId: "r-1",
      denialReason: POISON,
    });

    expect(html()).not.toContain('<a href="https://evil.example"');
    expect(html()).toContain("&lt;a href=");
  });
});
