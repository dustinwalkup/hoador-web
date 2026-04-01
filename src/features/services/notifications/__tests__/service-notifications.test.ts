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

  it("sendNoShowReportAdminNotification uses type service_no_show_reported", async () => {
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
      expect.objectContaining({ type: "service_no_show_reported" }),
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
