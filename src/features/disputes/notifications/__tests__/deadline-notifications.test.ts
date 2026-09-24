import { describe, it, expect, vi, beforeEach } from "vitest";
import { userDAL } from "@/dal";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import { mockDispute } from "@/test/fixtures/disputes";
import type { DisputeWithRelations } from "@/dal/types";
import {
  disputeParties,
  sendEvidenceDeadlineApproaching,
  sendEvidenceDeadlineExpired,
} from "../deadline-notifications";

vi.mock("@/dal", () => ({
  userDAL: { getUserById: vi.fn() },
}));

vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: vi.fn(),
}));

const DEADLINE = new Date("2026-09-25T17:00:00.000Z");

const rentalDispute: DisputeWithRelations = {
  ...mockDispute,
  status: "evidence_requested",
  evidenceDeadline: DEADLINE,
  rental: { ...mockDispute.rental!, listing: { name: "Pressure washer" } },
};

const serviceDispute: DisputeWithRelations = {
  ...mockDispute,
  status: "evidence_requested",
  evidenceDeadline: DEADLINE,
  rentalId: null,
  rental: null,
  serviceBookingId: "booking-1",
  serviceBooking: {
    id: "booking-1",
    requesterId: "requester-1",
    providerId: "provider-1",
    listing: { title: "Deck staining" },
  },
};

function callsTo(userId: string) {
  return vi
    .mocked(sendNotification)
    .mock.calls.map(([args]) => args)
    .filter((args) => args.userId === userId);
}

describe("deadline notifications (P-E13-9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://app.test";
    vi.mocked(userDAL.getUserById).mockImplementation(
      async (id: string) => ({ id, email: `${id}@example.com` }) as never,
    );
    vi.mocked(sendNotification).mockResolvedValue({ success: true });
  });

  describe("disputeParties", () => {
    it("names both parties of a rental", () => {
      expect(disputeParties(rentalDispute)).toEqual({
        userIds: ["user-123", "user-456"],
        listingName: "Pressure washer",
        subject: { rentalId: "rental-123" },
      });
    });

    it("names both parties of a service booking", () => {
      expect(disputeParties(serviceDispute)).toEqual({
        userIds: ["requester-1", "provider-1"],
        listingName: "Deck staining",
        subject: { serviceBookingId: "booking-1" },
      });
    });

    it("gives up on a dispute whose booking is gone", () => {
      expect(disputeParties({ ...rentalDispute, rental: null })).toBeNull();
    });
  });

  it("reminds both parties of a rental, with what the app routes on", async () => {
    const outcome = await sendEvidenceDeadlineApproaching(
      rentalDispute,
      DEADLINE,
    );

    expect(outcome).toEqual({ sent: 2, failed: 0 });
    for (const userId of ["user-123", "user-456"]) {
      const [call] = callsTo(userId);
      expect(call).toMatchObject({
        type: "dispute_evidence_deadline_approaching",
        title: "Less than a day to add evidence",
        linkUrl: "https://app.test/dashboard/disputes/dispute-123",
        data: {
          disputeId: "dispute-123",
          rentalId: "rental-123",
          evidenceDeadline: "2026-09-25T17:00:00.000Z",
          listingName: "Pressure washer",
        },
      });
      expect(call.email?.to).toBe(`${userId}@example.com`);
    }
  });

  // The old inline notice covered rental disputes only.
  it("tells both parties of a service dispute it expired", async () => {
    const outcome = await sendEvidenceDeadlineExpired(serviceDispute);

    expect(outcome).toEqual({ sent: 2, failed: 0 });
    const [requester] = callsTo("requester-1");
    expect(requester).toMatchObject({
      type: "dispute_evidence_deadline_expired",
      message: expect.stringContaining("Deck staining has passed"),
      data: { disputeId: "dispute-123", serviceBookingId: "booking-1" },
    });
    expect(requester.data).not.toHaveProperty("rentalId");
    expect(callsTo("provider-1")).toHaveLength(1);
  });

  it("escapes the listing title in the email HTML, not in the text", async () => {
    await sendEvidenceDeadlineApproaching(
      {
        ...rentalDispute,
        rental: { ...rentalDispute.rental!, listing: { name: "<b>Saw</b>" } },
      },
      DEADLINE,
    );

    const [call] = callsTo("user-123");
    expect(call.email?.html).toContain("&lt;b&gt;Saw&lt;/b&gt;");
    expect(call.email?.html).not.toContain("<b>Saw</b>");
    expect(call.email?.text).toContain("<b>Saw</b>");
  });

  // `sendNotification` reports an in-app failure as a value, not a throw.
  it("counts a party whose notice didn't go through, without stopping the other", async () => {
    vi.mocked(sendNotification).mockImplementation(async (args) =>
      args.userId === "user-456"
        ? { success: false, error: "insert failed" }
        : { success: true },
    );

    const outcome = await sendEvidenceDeadlineApproaching(
      rentalDispute,
      DEADLINE,
    );

    expect(outcome).toEqual({ sent: 1, failed: 1 });
  });

  it("still notifies in-app when a party has no email on file", async () => {
    vi.mocked(userDAL.getUserById).mockResolvedValue(null as never);

    const outcome = await sendEvidenceDeadlineApproaching(
      rentalDispute,
      DEADLINE,
    );

    expect(outcome).toEqual({ sent: 2, failed: 0 });
    expect(callsTo("user-123")[0].email).toBeUndefined();
  });
});
