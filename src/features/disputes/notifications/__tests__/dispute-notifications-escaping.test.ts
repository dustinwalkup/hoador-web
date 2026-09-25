import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DisputeWithRelations } from "@/dal/types";

/**
 * SEC-12: dispute emails carry the filer's own free text (the description) and
 * names to the other party and to staff, so every interpolation is escaped.
 */

const mockSendNotification = vi.fn();
vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: (...a: unknown[]) => mockSendNotification(...a),
}));

const POISON = '<a href="https://evil.example">Verify payout</a>';

vi.mock("@/dal", () => ({
  rentalDAL: {
    getRentalDetailsById: vi.fn().mockResolvedValue({
      renterId: "renter-1",
      ownerId: "owner-1",
      renterName: '<a href="https://evil.example">Verify payout</a>',
      ownerName: '<a href="https://evil.example">Verify payout</a>',
      listingName: '<a href="https://evil.example">Verify payout</a>',
    }),
  },
  serviceBookingDAL: {},
  userDAL: {
    getUserById: vi.fn(async (id: string) => ({ id, email: `${id}@x.test` })),
    getStaffNotificationRecipients: vi
      .fn()
      .mockResolvedValue([
        { id: "admin-1", email: "a@x.test", firstName: "Ada" },
      ]),
  },
}));

import { sendDisputeNotifications } from "../dispute-notifications";

const dispute = {
  id: "d-1",
  rentalId: "rental-1",
  serviceBookingId: null,
  createdBy: "renter-1",
  createdByRole: "renter",
  reasonCode: "damage",
  description: POISON,
  resolutionOutcome: "favor_renter",
  resolutionReason: POISON,
  createdByUser: { firstName: POISON, lastName: "X" },
  resolvedByUser: { firstName: POISON, lastName: "Y" },
} as unknown as DisputeWithRelations;

const allHtml = () =>
  mockSendNotification.mock.calls
    .map((c) => (c[0].email?.html as string) ?? "")
    .join("\n");

describe("dispute emails escape user text (SEC-12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["created", "resolved"] as const)("%s", async (event) => {
    await sendDisputeNotifications(dispute, event);
    // The staff email is fire-and-forget; let it settle.
    await new Promise((r) => setTimeout(r, 0));

    expect(mockSendNotification).toHaveBeenCalled();
    expect(allHtml()).not.toContain('<a href="https://evil.example"');
    expect(allHtml()).toContain("&lt;a href=");
  });
});
