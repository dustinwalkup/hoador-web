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

const { rentalRequests, serviceBookings, user } = schema;

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
