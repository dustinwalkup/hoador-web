import { describe, it, expect } from "vitest";
import { buildPushPayload } from "../push-payload";
import type { NotificationType } from "../notification-type-map";
import { needTypeEnum } from "@/db/schemas/_enums";

describe("push-payload", () => {
  const title = "Test title";
  const body = "Test body";
  const linkUrl = "/dashboard/rental/abc";
  const type: NotificationType = "rental_approved";

  it("returns payload with only type when data is empty", () => {
    const result = buildPushPayload(title, body, linkUrl, type, {});
    expect(result).toEqual({
      title,
      body,
      linkUrl,
      data: { type },
    });
  });

  it("includes rentalId when provided as string", () => {
    const result = buildPushPayload(title, body, linkUrl, type, {
      rentalId: "rental-123",
    });
    expect(result.data.rentalId).toBe("rental-123");
    expect(result.data.type).toBe(type);
  });

  it("includes conversationId when provided as string", () => {
    const result = buildPushPayload(title, body, linkUrl, "message_received", {
      conversationId: "conv-456",
    });
    expect(result.data.conversationId).toBe("conv-456");
    expect(result.data.type).toBe("message_received");
  });

  it("includes disputeId when provided as string", () => {
    const result = buildPushPayload(title, body, linkUrl, "dispute_created", {
      disputeId: "dispute-789",
    });
    expect(result.data.disputeId).toBe("dispute-789");
  });

  it("excludes PII and financial data from payload", () => {
    const result = buildPushPayload(title, body, linkUrl, type, {
      rentalId: "rental-1",
      renterName: "John Doe",
      ownerName: "Jane Smith",
      totalAmount: "99.99",
      email: "user@example.com",
      phone: "+15551234567",
    });
    expect(result.data).toEqual({
      type,
      rentalId: "rental-1",
    });
    expect((result.data as Record<string, unknown>).renterName).toBeUndefined();
    expect((result.data as Record<string, unknown>).ownerName).toBeUndefined();
    expect(
      (result.data as Record<string, unknown>).totalAmount,
    ).toBeUndefined();
    expect((result.data as Record<string, unknown>).email).toBeUndefined();
    expect((result.data as Record<string, unknown>).phone).toBeUndefined();
  });

  it("excludes non-string reference IDs (only string IDs included)", () => {
    const result = buildPushPayload(title, body, linkUrl, type, {
      rentalId: 123 as unknown as string,
      conversationId: null,
    });
    expect(result.data.rentalId).toBeUndefined();
    expect(result.data.conversationId).toBeUndefined();
  });

  // ─── P-E12-4: the widened allowlist ────────────────────────────────────────
  //
  // The three original keys predate the services marketplace, neighborhood
  // needs and reviews, so every service booking, listing and needs push reached
  // the device carrying nothing but {type, linkUrl} and deep-linked to the feed
  // instead of the thing that happened.

  it("includes bookingId for a service booking push", () => {
    // The case the mobile spec names by hand. `bookingId` is what the senders
    // pass; `serviceBookingId` appears elsewhere in the services code but never
    // inside a sendNotification data bag.
    const result = buildPushPayload(
      title,
      body,
      linkUrl,
      "service_booking_requested",
      { bookingId: "booking-1", listingId: "listing-1", totalAmount: "120.00" },
    );
    expect(result.data).toEqual({
      type: "service_booking_requested",
      bookingId: "booking-1",
      listingId: "listing-1",
    });
  });

  it("includes rentalRequestId, the one rental id some senders use instead", () => {
    // `expire-pending-bookings.ts` names a cancelled rental `rentalRequestId`
    // and passes no `rentalId`, so without this key that push carries no rental
    // reference at all and can only fall back to its linkUrl.
    const result = buildPushPayload(title, body, linkUrl, "rental_cancelled", {
      rentalRequestId: "req-1",
      listingId: "listing-1",
    });
    expect(result.data).toEqual({
      type: "rental_cancelled",
      rentalRequestId: "req-1",
      listingId: "listing-1",
    });
  });

  it("includes listingId for both item and service listings", () => {
    // Service listings have no separate key — `serviceListingId` does not exist
    // anywhere in this repo. The notification TYPE is what says which
    // marketplace, which is why the client keys its route table on the type.
    expect(
      buildPushPayload(title, body, linkUrl, "listing_approved", {
        listingId: "listing-1",
      }).data.listingId,
    ).toBe("listing-1");
    expect(
      buildPushPayload(title, body, linkUrl, "service_listing_approved", {
        listingId: "listing-2",
      }).data.listingId,
    ).toBe("listing-2");
  });

  it("includes needId for a neighborhood need push", () => {
    const result = buildPushPayload(
      title,
      body,
      linkUrl,
      "neighborhood_need_created",
      { needId: "need-1", needType: "rental" },
    );
    expect(result.data.needId).toBe("need-1");
  });

  it("keeps bookingId AND bookingType on a review, and drops the rest", () => {
    // `review_received` covers both marketplaces, so the id alone cannot choose
    // between the rental and the service booking screen. The reviewer's name
    // and the star rating travel in the same bag and must not survive.
    const result = buildPushPayload(title, body, linkUrl, "review_received", {
      bookingType: "service",
      bookingId: "booking-9",
      reviewerName: "Jane Smith",
      rating: 5,
    });
    expect(result.data).toEqual({
      type: "review_received",
      bookingId: "booking-9",
      bookingType: "service",
    });
  });

  it("keeps listingId, listingType and needId on a need-listing push", () => {
    // This bag carries BOTH ids. The client resolves it to the LISTING, by the
    // type, not by an id-precedence order — which is why needId surviving here
    // is harmless and why listingType is what actually picks the screen.
    const result = buildPushPayload(
      title,
      body,
      linkUrl,
      "neighborhood_need_listing_created",
      { listingId: "listing-7", listingType: "rental", needId: "need-7" },
    );
    expect(result.data).toEqual({
      type: "neighborhood_need_listing_created",
      listingId: "listing-7",
      listingType: "rental",
      needId: "need-7",
    });
  });

  it("drops a marketplace discriminator it does not recognize", () => {
    // Falling back to `linkUrl` is correct here; guessing a marketplace is not.
    const result = buildPushPayload(title, body, linkUrl, "review_received", {
      bookingId: "booking-9",
      bookingType: "barter" as unknown as string,
    });
    expect(result.data.bookingType).toBeUndefined();
    expect(result.data.bookingId).toBe("booking-9");
  });

  it("accepts exactly the marketplace kinds the database defines", () => {
    // Pins the union to `need_type`. A third value added to the pg enum fails
    // here rather than silently dropping out of every push.
    expect([...needTypeEnum.enumValues].sort()).toEqual(["rental", "service"]);
    for (const kind of needTypeEnum.enumValues) {
      const result = buildPushPayload(
        title,
        body,
        linkUrl,
        "neighborhood_need_listing_created",
        { listingType: kind },
      );
      expect(result.data.listingType).toBe(kind);
    }
  });

  // ⚠️ The rule this whole function exists for. 11 sendNotification call sites
  // across 7 files put a money value in their data bag; this payload is copied
  // from the real staging `rental_request_created` row. If the allowlist is
  // ever replaced by a spread, this is the test that fails.
  it("never lets a money value through, however many keys are allowlisted", () => {
    const result = buildPushPayload(
      title,
      body,
      linkUrl,
      "rental_request_created",
      {
        rentalId: "53a75728-e1d6-4a3a-84c2-04f58cbf01e8",
        totalAmount: "2780.95",
        refundAmount: "100.00",
        listingName: "UAT-P1-18: Zero deposit listing",
        renterName: "Dustin Walkup",
        failureReason: "card_declined",
        providerId: "SrEJRomoJWmF3zsFU9gXPJ3relGslqor",
        ownerId: "owner-1",
      },
    );
    expect(result.data).toEqual({
      type: "rental_request_created",
      rentalId: "53a75728-e1d6-4a3a-84c2-04f58cbf01e8",
    });
    // Stated as a property too, not just as a shape: no value anywhere in the
    // payload's data may look like an amount.
    expect(JSON.stringify(result.data)).not.toMatch(/\d+\.\d{2}/);
  });

  it("works with undefined data", () => {
    const result = buildPushPayload(title, body, linkUrl, type);
    expect(result).toEqual({
      title,
      body,
      linkUrl,
      data: { type },
    });
  });
});
