import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";

/**
 * BIZ-07 against a REAL Postgres: deleting an account withdraws the user's own
 * pending requests, and no approval or acceptance can charge them afterwards.
 * Every statement is real; the race runs on two pooled connections.
 */

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { accountDeletionDAL, rentalDAL, serviceBookingDAL } from "@/dal";
import {
  createUser,
  createListing,
  createRentalRequest,
  createServiceListing,
  createServiceBooking,
} from "@/test/integration/factories";
import { raceTwo } from "@/test/integration/run-concurrently";

const {
  rentalRequests,
  serviceBookings,
  user,
  rentals,
  disputes,
  disputeEvidence,
  listingImages,
  listings,
  serviceListings,
  pushSubscriptions,
  userActivityLog,
} = schema;

const requestById = async (id: string) =>
  (await db.select().from(rentalRequests).where(eq(rentalRequests.id, id)))[0];
const bookingById = async (id: string) =>
  (
    await db.select().from(serviceBookings).where(eq(serviceBookings.id, id))
  )[0];

/** A renter with one pending rental request against someone else's listing. */
async function renterWithRequest(
  overrides: Parameters<typeof createRentalRequest>[3] = {},
) {
  const owner = await createUser();
  const renter = await createUser();
  const listing = await createListing(owner.id, { name: "Pressure Washer" });
  const request = await createRentalRequest(
    listing.id,
    renter.id,
    owner.id,
    overrides,
  );
  return { owner, renter, request };
}

describe("account deletion withdraws outbound requests (BIZ-07, real DB)", () => {
  it("cancels the user's pending rental request and reports its owner", async () => {
    const { owner, renter, request } = await renterWithRequest();

    const result = await accountDeletionDAL.anonymizeUser(renter.id);

    const stored = await requestById(request.id);
    expect(stored.status).toBe("cancelled");
    expect(stored.cancellationReason).toBe("renter_cancellation");
    expect(stored.denialReason).toBe("Account deleted");
    expect(result.cancelledRentalRequests).toEqual([
      { id: request.id, ownerId: owner.id, listingName: "Pressure Washer" },
    ]);
  });

  it("cancels pending and payment_failed service bookings, and reports the provider", async () => {
    const provider = await createUser();
    const requester = await createUser();
    const service = await createServiceListing(provider.id, {
      title: "Lawn mowing",
    });
    const pending = await createServiceBooking(service, requester.id);
    const retryable = await createServiceBooking(service, requester.id, {
      status: "payment_failed",
      paymentStatus: "failed",
    });

    const result = await accountDeletionDAL.anonymizeUser(requester.id);

    expect((await bookingById(pending.id)).status).toBe("cancelled");
    expect((await bookingById(retryable.id)).status).toBe("cancelled");
    expect((await bookingById(pending.id)).cancellationReason).toBe(
      "account_deleted",
    );
    expect(result.cancelledServiceBookings).toHaveLength(2);
    expect(result.cancelledServiceBookings[0]).toMatchObject({
      providerId: provider.id,
      serviceTitle: "Lawn mowing",
    });
  });

  // A charge already in flight is left for the stale-claim detector:
  // cancelling it here would strand a charged renter with no request.
  it("leaves a request whose charge is already claimed", async () => {
    const { renter, request } = await renterWithRequest({
      paymentStatus: "processing",
    });

    const result = await accountDeletionDAL.anonymizeUser(renter.id);

    const stored = await requestById(request.id);
    expect(stored.status).toBe("pending");
    expect(stored.paymentStatus).toBe("processing");
    expect(result.cancelledRentalRequests).toHaveLength(0);
  });

  it("touches only the deleted user's own outbound requests", async () => {
    const { request: someoneElses } = await renterWithRequest();
    const bystander = await createUser();

    await accountDeletionDAL.anonymizeUser(bystander.id);

    expect((await requestById(someoneElses.id)).status).toBe("pending");
  });

  it("returns the Stripe customer whose cards must be detached", async () => {
    const renter = await createUser({ stripeCustomerId: "cus_integration" });

    const result = await accountDeletionDAL.anonymizeUser(renter.id);

    expect(result.stripeCustomerId).toBe("cus_integration");
  });
});

describe("claims refuse a deleted counterparty (BIZ-07, real DB)", () => {
  // The claim's own EXISTS guard, isolated from the status check: a row with
  // anonymized_at set is refused even while its status still reads 'active'.
  it("will not claim a rental charge on an anonymized renter", async () => {
    const { renter, request } = await renterWithRequest();
    await db
      .update(user)
      .set({ anonymizedAt: new Date() })
      .where(eq(user.id, renter.id));

    expect(
      await rentalDAL.claimRentalRequestPaymentProcessing(request.id),
    ).toBe(false);
    expect((await requestById(request.id)).paymentStatus).toBe("pending");
  });

  it("will not claim a rental charge on a suspended renter", async () => {
    const { renter, request } = await renterWithRequest();
    await db
      .update(user)
      .set({ status: "suspended" })
      .where(eq(user.id, renter.id));

    expect(
      await rentalDAL.claimRentalRequestPaymentProcessing(request.id),
    ).toBe(false);
  });

  it("will not claim a service charge on an anonymized requester", async () => {
    const provider = await createUser();
    const requester = await createUser();
    const service = await createServiceListing(provider.id);
    const booking = await createServiceBooking(service, requester.id);
    await db
      .update(user)
      .set({ anonymizedAt: new Date() })
      .where(eq(user.id, requester.id));

    expect(await serviceBookingDAL.claimForAcceptance(booking.id)).toBe(false);
    expect((await bookingById(booking.id)).paymentStatus).toBeNull();
  });

  // Deletion and an owner's approval claim hit the same request at once.
  // Whichever wins, the request ends consistent: withdrawn and never charged,
  // or claimed and left for the charge to finish. Never cancelled mid-charge.
  it("keeps the request consistent when deletion races an approval claim", async () => {
    const { renter, request } = await renterWithRequest();

    await raceTwo(
      () => accountDeletionDAL.anonymizeUser(renter.id).then(() => "deleted"),
      () =>
        rentalDAL
          .claimRentalRequestPaymentProcessing(request.id)
          .then((won) => (won ? "claimed" : "refused")),
    );

    const stored = await requestById(request.id);
    const outcome = `${stored.status}/${stored.paymentStatus}`;
    expect(["cancelled/pending", "pending/processing"]).toContain(outcome);
  });
});

const STORE = "https://store.public.blob.vercel-storage.com";

/** A rental between two users, optionally with the owner's damage photos. */
async function createRental(
  owner: { id: string },
  renter: { id: string },
  damagePhotos: (rentalId: string) => string[] = () => [],
) {
  const listing = await createListing(owner.id);
  const request = await createRentalRequest(listing.id, renter.id, owner.id, {
    status: "completed",
  });
  const [rental] = await db
    .insert(rentals)
    .values({
      requestId: request.id,
      listingId: listing.id,
      renterId: renter.id,
      ownerId: owner.id,
      startDate: request.startDate,
      endDate: request.endDate,
      totalAmount: request.totalAmount,
    })
    .returning();
  const photos = damagePhotos(rental.id);
  if (photos.length > 0) {
    await db
      .update(rentals)
      .set({ damagePhotos: photos })
      .where(eq(rentals.id, rental.id));
  }
  return rental;
}

/** A dispute on `rentalId` with one image uploaded by `uploaderId`. */
async function createEvidence(
  rentalId: string,
  uploaderId: string,
  status: "open" | "resolved",
) {
  const [dispute] = await db
    .insert(disputes)
    .values({
      rentalId,
      createdBy: uploaderId,
      createdByRole: "owner",
      reasonCode: "damage",
      description: "Returned with a cracked housing",
      policyVersion: "1",
      status,
    })
    .returning();
  const [evidence] = await db
    .insert(disputeEvidence)
    .values({
      disputeId: dispute.id,
      uploadedBy: uploaderId,
      uploadedByRole: "owner",
      evidenceType: "image",
      content: `${STORE}/disputes/${dispute.id}/evidence/1.jpg`,
    })
    .returning();
  return { dispute, evidence };
}

describe("account deletion scrubs uploads and leftover PII (PRIV-09, real DB)", () => {
  it("unlinks every upload, returns their blob paths, and clears leftover PII", async () => {
    const me = await createUser();
    const other = await createUser();

    const listing = await createListing(me.id);
    await db.insert(listingImages).values([
      {
        listingId: listing.id,
        imageUrl: `${STORE}/listings/${listing.id}/1.jpg`,
        blobPathname: `listings/${listing.id}/1.jpg`,
      },
      // Seed rows use fake paths: unlinked, but never sent to blob delete.
      {
        listingId: listing.id,
        imageUrl: "https://picsum.photos/1",
        blobPathname: "mock/1.jpg",
      },
    ]);

    const service = await createServiceListing(me.id);
    await db
      .update(serviceListings)
      .set({
        photos: [
          `${STORE}/service-listings/${service.id}/a.jpg`,
          `${STORE}/service-listings/${service.id}/b.jpg`,
        ],
      })
      .where(eq(serviceListings.id, service.id));

    // Pre-SEC-22 damage photos could be any URL; only our own prefix is deleted.
    const owned = await createRental(me, other, (id) => [
      `${STORE}/rentals/${id}/damage/1.jpg`,
      `${STORE}/listings/someone-elses/1.jpg`,
    ]);
    const { evidence } = await createEvidence(owned.id, me.id, "resolved");

    const theirListing = await createListing(other.id);
    const myRequest = await createRentalRequest(
      theirListing.id,
      me.id,
      other.id,
      {
        status: "completed",
        deliveryAddress: "1 Main St",
        deliveryInstructions: "Side gate",
        message: "Hi, it's Jane",
        attributionContext: { fbp: "fb.1", ip: "203.0.113.9", userAgent: "UA" },
      },
    );

    await db.insert(userActivityLog).values({
      userId: me.id,
      activityType: "login",
      ipAddress: "203.0.113.9",
      userAgent: "UA",
    });
    await db.insert(pushSubscriptions).values([
      {
        userId: me.id,
        endpoint: `ep-${me.id}-1`,
        platform: "ios",
        token: "t1",
      },
      { userId: me.id, endpoint: `ep-${me.id}-2`, isActive: false },
    ]);

    const result = await accountDeletionDAL.anonymizeUser(me.id);

    expect(result.blobPathnamesToDelete.sort()).toEqual(
      [
        `listings/${listing.id}/1.jpg`,
        `service-listings/${service.id}/a.jpg`,
        `service-listings/${service.id}/b.jpg`,
        `rentals/${owned.id}/damage/1.jpg`,
        `disputes/${evidence.disputeId}/evidence/1.jpg`,
      ].sort(),
    );
    expect(result.skippedOpenDisputeEvidenceCount).toBe(0);

    expect(
      await db
        .select()
        .from(listingImages)
        .where(eq(listingImages.listingId, listing.id)),
    ).toHaveLength(0);
    const [storedListing] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, listing.id));
    expect(storedListing.isActive).toBe(false);
    const [storedService] = await db
      .select()
      .from(serviceListings)
      .where(eq(serviceListings.id, service.id));
    expect(storedService.photos).toEqual([]);
    const [storedRental] = await db
      .select()
      .from(rentals)
      .where(eq(rentals.id, owned.id));
    expect(storedRental.damagePhotos).toEqual([]);
    const [storedEvidence] = await db
      .select()
      .from(disputeEvidence)
      .where(eq(disputeEvidence.id, evidence.id));
    expect(storedEvidence).toMatchObject({
      evidenceType: "text",
      content: "[Photo removed — account deleted]",
    });

    const storedRequest = await requestById(myRequest.id);
    expect(storedRequest).toMatchObject({
      deliveryAddress: null,
      deliveryInstructions: null,
      message: null,
      attributionContext: null,
    });
    const [activity] = await db
      .select()
      .from(userActivityLog)
      .where(eq(userActivityLog.userId, me.id));
    expect(activity).toMatchObject({ ipAddress: null, userAgent: null });
    expect(
      await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, me.id)),
    ).toHaveLength(0);
  });

  // Unreachable through getDeletionBlockers; inserted directly to prove the
  // defensive filter the service alerts on.
  it("keeps and counts evidence on a dispute that is still open", async () => {
    const me = await createUser();
    const other = await createUser();
    const rental = await createRental(me, other);
    const { evidence } = await createEvidence(rental.id, me.id, "open");

    const result = await accountDeletionDAL.anonymizeUser(me.id);

    expect(result.skippedOpenDisputeEvidenceCount).toBe(1);
    expect(result.blobPathnamesToDelete).toEqual([]);
    const [stored] = await db
      .select()
      .from(disputeEvidence)
      .where(eq(disputeEvidence.id, evidence.id));
    expect(stored).toMatchObject({
      evidenceType: "image",
      content: evidence.content,
    });
  });

  it("leaves the owner's damage photos alone when the renter deletes", async () => {
    const owner = await createUser();
    const me = await createUser();
    const rental = await createRental(owner, me, (id) => [
      `${STORE}/rentals/${id}/damage/1.jpg`,
    ]);

    const result = await accountDeletionDAL.anonymizeUser(me.id);

    expect(result.blobPathnamesToDelete).toEqual([]);
    const [stored] = await db
      .select()
      .from(rentals)
      .where(eq(rentals.id, rental.id));
    expect(stored.damagePhotos).toEqual([
      `${STORE}/rentals/${rental.id}/damage/1.jpg`,
    ]);
  });
});
