import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendNotification = vi.fn();
const mockGetUserById = vi.fn();
const mockGetStaff = vi.fn();
const mockListingGetById = vi.fn();

vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

vi.mock("@/dal", () => ({
  userDAL: {
    getUserById: (...args: unknown[]) => mockGetUserById(...args),
    getStaffNotificationRecipients: (...args: unknown[]) =>
      mockGetStaff(...args),
  },
  serviceListingDAL: {
    getById: (...args: unknown[]) => mockListingGetById(...args),
  },
}));

import {
  sendBookingAcceptedNotification,
  sendBookingDeclinedNotification,
  sendJobCompletedNotification,
  sendListingApprovedNotification,
  sendListingPendingAdminNotification,
  sendListingRejectedNotification,
  sendNewBookingRequestNotification,
  sendNoShowReportAdminNotification,
  sendPaymentMethodUpdatedProviderNotification,
  sendPaymentMethodUpdatedRequesterConfirmationNotification,
  sendServicePayoutNotification,
} from "../service-notifications";

const baseBooking = {
  id: "book-1",
  listingId: "list-1",
  requesterId: "req-1",
  providerId: "prov-1",
  communityId: "comm-1",
  proposedDate: "2026-04-15",
  proposedTime: "10:00",
  hours: null,
  notes: null,
  declineReason: null,
  servicePrice: "75.00",
  serviceFee: "5.00",
  totalAmount: "80.00",
  status: "pending" as const,
  stripePaymentIntentId: null,
  stripeChargeId: null,
  paymentStatus: null,
  refundAmount: null,
  stripeRefundId: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseListing = {
  id: "list-1",
  communityId: "comm-1",
  providerId: "prov-1",
  categoryId: "cat-1",
  title: "Drain",
  description: "x",
  pricingType: "fixed" as const,
  price: "75.00",
  photos: [] as string[],
  ownerPoliciesAcknowledged: true,
  serviceNotes: null as string | null,
  status: "active" as const,
  adminNote: null as string | null,
  rejectionReason: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("service-notifications (sendNotification delegation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendNotification.mockResolvedValue({ success: true });
    mockGetUserById.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      firstName: "A",
      lastName: "B",
      name: "AB",
    });
    mockListingGetById.mockResolvedValue({ ...baseListing, title: "Listed" });
    mockGetStaff.mockResolvedValue([
      {
        id: "admin-1",
        email: "admin@hoa.com",
        firstName: "Admin",
        lastName: "User",
      },
    ]);
  });

  it("sendNewBookingRequestNotification uses type service_booking_requested", async () => {
    await sendNewBookingRequestNotification("prov-1", baseBooking as never);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "service_booking_requested" }),
    );
  });

  it("sendNewBookingRequestNotification formats proposed date as long US style", async () => {
    await sendNewBookingRequestNotification("prov-1", baseBooking as never);
    const payload = mockSendNotification.mock.calls[0][0] as {
      message: string;
      data: { proposedDate: string };
      email: { html: string; text: string };
    };
    expect(payload.message).toContain("April 15, 2026");
    expect(payload.data.proposedDate).toBe("April 15, 2026");
    expect(payload.email.html).toContain("April 15, 2026");
    expect(payload.email.text).toContain("April 15, 2026");
  });

  it("sendBookingAcceptedNotification uses type service_booking_accepted", async () => {
    await sendBookingAcceptedNotification("req-1", {
      ...baseBooking,
      status: "accepted",
    } as never);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "service_booking_accepted" }),
    );
  });

  it("sendBookingAcceptedNotification includes formatted date in message and email", async () => {
    await sendBookingAcceptedNotification("req-1", {
      ...baseBooking,
      status: "accepted",
    } as never);
    const payload = mockSendNotification.mock.calls[0][0] as {
      message: string;
      data: { proposedDate: string };
      email: { html: string; text: string };
    };
    expect(payload.message).toContain("April 15, 2026");
    expect(payload.data.proposedDate).toBe("April 15, 2026");
    expect(payload.email.html).toContain("April 15, 2026");
    expect(payload.email.text).toContain("April 15, 2026");
    expect(payload.email.text).toContain("Scheduled for:");
  });

  it("sendBookingDeclinedNotification uses type service_booking_declined", async () => {
    await sendBookingDeclinedNotification(
      "req-1",
      { ...baseBooking, status: "declined" } as never,
      "busy",
    );
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "service_booking_declined" }),
    );
  });

  it("sendJobCompletedNotification uses type service_booking_completed", async () => {
    await sendJobCompletedNotification("req-1", {
      ...baseBooking,
      status: "completed",
    } as never);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "service_booking_completed" }),
    );
  });

  it("sendServicePayoutNotification uses type service_payout_sent", async () => {
    await sendServicePayoutNotification("prov-1", {
      ...baseBooking,
      status: "completed",
    } as never);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "service_payout_sent" }),
    );
  });

  it("sendListingApprovedNotification uses type service_listing_approved", async () => {
    await sendListingApprovedNotification("prov-1", baseListing as never);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "service_listing_approved" }),
    );
  });

  it("sendListingRejectedNotification uses type service_listing_rejected", async () => {
    await sendListingRejectedNotification(
      "prov-1",
      baseListing as never,
      "nope",
    );
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "service_listing_rejected" }),
    );
  });

  it("sendListingPendingAdminNotification uses type service_listing_pending", async () => {
    await sendListingPendingAdminNotification(baseListing as never);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "service_listing_pending" }),
    );
  });

  it("sendNoShowReportAdminNotification uses type system with no-show data", async () => {
    await sendNoShowReportAdminNotification(
      {
        id: "ns-1",
        bookingId: "book-1",
        reportedBy: "req-1",
        notes: null,
        reportedAt: new Date(),
      } as never,
      baseBooking as never,
    );
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "system",
        data: expect.objectContaining({
          kind: "service_no_show_report",
          bookingId: "book-1",
        }),
      }),
    );
  });

  it("sendNoShowReportAdminNotification includes formatted scheduled date", async () => {
    await sendNoShowReportAdminNotification(
      {
        id: "ns-1",
        bookingId: "book-1",
        reportedBy: "req-1",
        notes: null,
        reportedAt: new Date(),
      } as never,
      baseBooking as never,
    );
    const payload = mockSendNotification.mock.calls[0][0] as {
      message: string;
      email: { html: string; text: string };
    };
    expect(payload.message).toContain("April 15, 2026");
    expect(payload.email.html).toContain("April 15, 2026");
    expect(payload.email.text).toContain("April 15, 2026");
  });
});

/**
 * TERMINOLOGY-GUIDELINES §3.2 and §6.2: a booking is only a booking once it is
 * accepted, the person on the other side is the client (never "requester"),
 * notifications lead with that person, and payouts go to the payout account.
 */
describe("service-notifications (canonical terminology)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendNotification.mockResolvedValue({ success: true });
    mockListingGetById.mockResolvedValue({ ...baseListing, title: "Drain" });
    mockGetUserById.mockImplementation(async (id: string) => ({
      id,
      email: `${id}@example.com`,
      firstName: id === "req-1" ? "Casey" : "Pat",
      lastName: id === "req-1" ? "Client" : "Provider",
      name: id,
    }));
  });

  function lastPayload() {
    return mockSendNotification.mock.calls.at(-1)?.[0] as {
      title: string;
      message: string;
      email: { subject: string; html: string; text: string };
    };
  }

  it("a new booking request leads with the client's name", async () => {
    await sendNewBookingRequestNotification("prov-1", baseBooking as never);
    const payload = lastPayload();
    expect(payload.title).toBe("New booking request");
    expect(payload.message).toBe(
      'Casey Client requested "Drain" for April 15, 2026.',
    );
  });

  it("a new booking request still sends when the client can't be named", async () => {
    mockGetUserById.mockImplementation(async (id: string) => {
      if (id === "req-1") throw new Error("User not found");
      return { id, email: "p@example.com", firstName: "Pat", name: id };
    });
    await sendNewBookingRequestNotification("prov-1", baseBooking as never);
    expect(lastPayload().message).toBe(
      'A neighbor requested "Drain" for April 15, 2026.',
    );
  });

  it("accepting and declining name the booking request", async () => {
    await sendBookingAcceptedNotification("req-1", baseBooking as never);
    expect(lastPayload().title).toBe("Booking request accepted");
    expect(lastPayload().message).toMatch(/^Your booking request for "Drain"/);
    expect(lastPayload().email.subject).toBe("Booking request accepted: Drain");

    await sendBookingDeclinedNotification(
      "req-1",
      baseBooking as never,
      "Busy",
    );
    expect(lastPayload().title).toBe("Booking request declined");
    expect(lastPayload().email.text).toContain(
      "Your booking request for Drain was declined.",
    );
  });

  it("a payout goes to the payout account, not a 'connected account'", async () => {
    await sendServicePayoutNotification("prov-1", baseBooking as never);
    const payload = lastPayload();
    expect(payload.message).toBe(
      'Payout for "Drain" was sent to your payout account.',
    );
    expect(payload.email.html).not.toMatch(/connected account/i);
  });

  it("a payment-method update names the client, never 'the requester'", async () => {
    await sendPaymentMethodUpdatedProviderNotification(
      "prov-1",
      { id: "book-1", listingId: "list-1" },
      "req-1",
    );
    const payload = lastPayload();
    expect(payload.title).toBe("Casey Client updated their payment method");
    expect(payload.message).toBe(
      'Casey Client updated their payment method for "Drain". You can now retry accepting the booking request.',
    );
    expect(payload.email.subject).toBe(
      "Action needed: retry booking request for Drain",
    );
    expect(JSON.stringify(payload)).not.toMatch(/requester/i);

    await sendPaymentMethodUpdatedRequesterConfirmationNotification("req-1", {
      id: "book-1",
      listingId: "list-1",
    });
    expect(lastPayload().message).toBe(
      'Your provider has been notified and can now retry accepting your booking request for "Drain".',
    );
  });

  it("moderation says 'needs changes', never 'not approved'", async () => {
    await sendListingRejectedNotification(
      "prov-1",
      baseListing as never,
      "Blurry photos",
    );
    const payload = lastPayload();
    expect(payload.title).toBe("Listing needs changes");
    expect(payload.message).toBe(
      '"Drain" needs changes before it can be approved. Reason: Blurry photos',
    );
  });

  it("staff see 'pending approval' for a new service listing", async () => {
    mockGetStaff.mockResolvedValue([
      { id: "admin-1", email: "admin@hoa.com", firstName: "Admin" },
    ]);
    await sendListingPendingAdminNotification(baseListing as never);
    expect(lastPayload().title).toBe("Service listing pending approval");
  });
});
