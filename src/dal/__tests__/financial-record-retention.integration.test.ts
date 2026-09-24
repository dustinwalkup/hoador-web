import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";

/**
 * DB-01 against a REAL Postgres: a completed rental's payment record, payout
 * lifecycle and signed agreement survive the listing's deletion. Deleting a
 * listing with rental history archives it; the FKs from those records are
 * RESTRICT (migration 0073), so nothing can cascade them away.
 */

vi.mock("@/services/vercel-blob", () => ({ deleteFromBlob: vi.fn() }));

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { listingDAL, userDAL } from "@/dal";
import {
  createUser,
  createListing,
  createRentalRequest,
  daysFromToday,
} from "@/test/integration/factories";

const {
  user,
  listings,
  rentalRequests,
  rentals,
  payments,
  rentalPaymentLifecycle,
  rentalAgreementDocuments,
  disputes,
  disputeFinancialOperations,
} = schema;

/** A completed, paid rental with its payout lifecycle and signed agreement. */
async function completedRental() {
  const owner = await createUser();
  const renter = await createUser();
  const listing = await createListing(owner.id);
  const request = await createRentalRequest(listing.id, renter.id, owner.id, {
    status: "completed",
    paymentStatus: "succeeded",
    startDate: daysFromToday(-10),
    endDate: daysFromToday(-8),
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
  await db.insert(payments).values({
    rentalId: rental.id,
    payerId: renter.id,
    payeeId: owner.id,
    amount: "81.00",
    platformFee: "6.00",
    status: "succeeded",
    paymentType: "rental_charge",
  });
  await db.insert(rentalPaymentLifecycle).values({
    rentalId: rental.id,
    rentalChargeId: "ch_integration",
    depositHoldStatus: "released",
  });
  await db.insert(rentalAgreementDocuments).values({
    rentalRequestId: request.id,
    pdfUrl: "https://example.com/agreement.pdf",
    templateVersion: "1",
  });
  return { owner, renter, listing, request, rental };
}

const pgCode = (error: unknown) =>
  (
    ((error as { cause?: { code?: string } }).cause ?? error) as {
      code?: string;
    }
  ).code;

describe("financial record retention (DB-01, real DB)", () => {
  it("archives a listing with a completed rental and keeps every record", async () => {
    const { listing, request, rental } = await completedRental();

    await listingDAL.deleteListing(listing.id);

    const [stored] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, listing.id));
    expect(stored.isActive).toBe(false);
    expect(
      await db
        .select()
        .from(rentalRequests)
        .where(eq(rentalRequests.id, request.id)),
    ).toHaveLength(1);
    expect(
      await db.select().from(payments).where(eq(payments.rentalId, rental.id)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(rentalPaymentLifecycle)
        .where(eq(rentalPaymentLifecycle.rentalId, rental.id)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(rentalAgreementDocuments)
        .where(eq(rentalAgreementDocuments.rentalRequestId, request.id)),
    ).toHaveLength(1);
  });

  it("still hard-deletes a listing nobody ever requested", async () => {
    const owner = await createUser();
    const listing = await createListing(owner.id);

    await listingDAL.deleteListing(listing.id);

    expect(
      await db.select().from(listings).where(eq(listings.id, listing.id)),
    ).toHaveLength(0);
  });

  // The constraints themselves, bypassing the app: RESTRICT refuses the
  // delete that used to cascade.
  it("refuses to delete a rental that has a payment record", async () => {
    const { rental } = await completedRental();

    const error = await db
      .delete(rentals)
      .where(eq(rentals.id, rental.id))
      .catch((e: unknown) => e);

    expect(pgCode(error)).toBe("23503");
  });

  it("refuses to delete a rental request that has a signed agreement", async () => {
    const { request, rental } = await completedRental();
    await db.delete(payments).where(eq(payments.rentalId, rental.id));
    await db
      .delete(rentalPaymentLifecycle)
      .where(eq(rentalPaymentLifecycle.rentalId, rental.id));
    await db.delete(rentals).where(eq(rentals.id, rental.id));

    const error = await db
      .delete(rentalRequests)
      .where(eq(rentalRequests.id, request.id))
      .catch((e: unknown) => e);

    expect(pgCode(error)).toBe("23503");
  });

  it("reports payment or rental history for both parties, and none for a bystander", async () => {
    const { owner, renter } = await completedRental();
    const bystander = await createUser();

    expect(await userDAL.hasFinancialHistory(owner.id)).toBe(true);
    expect(await userDAL.hasFinancialHistory(renter.id)).toBe(true);
    expect(await userDAL.hasFinancialHistory(bystander.id)).toBe(false);
  });

  // `performed_by` was NOT NULL with ON DELETE SET NULL, so deleting an admin
  // who had ever performed a dispute operation failed outright.
  it("keeps a dispute operation when the admin who performed it is deleted", async () => {
    const { renter, rental } = await completedRental();
    const admin = await createUser();
    const [dispute] = await db
      .insert(disputes)
      .values({
        rentalId: rental.id,
        createdBy: renter.id,
        createdByRole: "renter",
        reasonCode: "damage",
        description: "Integration dispute",
        policyVersion: "1",
      })
      .returning();
    const [operation] = await db
      .insert(disputeFinancialOperations)
      .values({
        disputeId: dispute.id,
        operationType: "hold_payout",
        performedBy: admin.id,
      })
      .returning();

    await db.delete(user).where(eq(user.id, admin.id));

    const [stored] = await db
      .select()
      .from(disputeFinancialOperations)
      .where(eq(disputeFinancialOperations.id, operation.id));
    expect(stored.performedBy).toBeNull();
  });
});
