import { and, or, eq, inArray, sql, count } from "drizzle-orm";
import { BaseDAL } from "./base";
import { NotFoundError } from "./errors";
import {
  user,
  session,
  account,
  userAddresses,
  userPaymentMethods,
} from "@/db/schemas/user.schema";
import { rentalRequests, rentals } from "@/db/schemas/rentals.schema";
import { serviceBookings, serviceListings } from "@/db/schemas/services.schema";
import { listings } from "@/db/schemas/listings.schema";
import { neighborhoodNeeds } from "@/db/schemas/neighborhood-needs.schema";
import { pushSubscriptions } from "@/db/schemas/notifications.schema";
import { rentalPaymentLifecycle } from "@/db/schemas/rental-payment-lifecycle.schema";
import { servicePaymentLifecycle } from "@/db/schemas/service-payment-lifecycle.schema";
import { disputes } from "@/db/schemas/disputes.schema";

/**
 * Blocking state sets for account deletion (D-E2-8, user-approved).
 *
 * These encode the load-bearing decision: **terminal failure states do not
 * block** — a `failed`/`release_failed` deposit or a `failed` payout/transfer
 * may never resolve, and an unclearable blocker would make deletion permanently
 * unreachable, an App Store policy violation. Money owed on a failed lifecycle
 * is retained against the anonymized id for ops to settle; it does not trap the
 * account. Exported and unit-tested directly so this decision is verified
 * without a database (the queries below merely consume them).
 */
export const BLOCKING_RENTAL_STATUSES = [
  "approved",
  "active",
  "overdue",
] as const;
export const BLOCKING_BOOKING_STATUSES = [
  "accepted",
  "payment_failed", // provider is awaiting the requester's card update — not terminal
] as const;
export const BLOCKING_DEPOSIT_STATUSES = ["scheduled", "held"] as const;
export const BLOCKING_PAYOUT_STATUSES = ["pending", "processing"] as const;
export const BLOCKING_TRANSFER_STATUSES = [
  "pending",
  "processing",
  "frozen",
] as const;
export const BLOCKING_DISPUTE_STATUSES = [
  "open",
  "evidence_requested",
  "under_review",
] as const;

/**
 * Read-only queries backing self-service account-deletion blocker checks.
 *
 * All methods are counts, not row fetches — the caller only needs "how many",
 * and a count keeps the blocker check cheap.
 *
 * Requirements: 2.5.2
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.6.1
 */
export class AccountDeletionDAL extends BaseDAL {
  /**
   * Rentals in flight on either side. Status lives on `rental_requests`
   * (`rentals` is the post-approval record with no status of its own).
   */
  async countActiveRentals(userId: string): Promise<number> {
    try {
      const [row] = await this.db
        .select({ n: count() })
        .from(rentalRequests)
        .where(
          and(
            or(
              eq(rentalRequests.renterId, userId),
              eq(rentalRequests.ownerId, userId),
            ),
            inArray(rentalRequests.status, [...BLOCKING_RENTAL_STATUSES]),
          ),
        );
      return row?.n ?? 0;
    } catch (error) {
      this.handleError(error, "countActiveRentals");
    }
  }

  /** Service bookings in flight on either side. `payment_failed` blocks — the provider is awaiting the requester's card update. */
  async countActiveBookings(userId: string): Promise<number> {
    try {
      const [row] = await this.db
        .select({ n: count() })
        .from(serviceBookings)
        .where(
          and(
            or(
              eq(serviceBookings.requesterId, userId),
              eq(serviceBookings.providerId, userId),
            ),
            inArray(serviceBookings.status, [...BLOCKING_BOOKING_STATUSES]),
          ),
        );
      return row?.n ?? 0;
    } catch (error) {
      this.handleError(error, "countActiveBookings");
    }
  }

  /**
   * Incoming requests the user owns and has not yet answered — as rental owner
   * or service provider. A counterpart is waiting on them, so these block.
   * (Outbound pending requests the user *made* are theirs to withdraw and do
   * not block; both also self-expire via cron.)
   */
  async countPendingOwnedRequests(userId: string): Promise<number> {
    try {
      const [rentalRow] = await this.db
        .select({ n: count() })
        .from(rentalRequests)
        .where(
          and(
            eq(rentalRequests.ownerId, userId),
            eq(rentalRequests.status, "pending"),
          ),
        );
      const [bookingRow] = await this.db
        .select({ n: count() })
        .from(serviceBookings)
        .where(
          and(
            eq(serviceBookings.providerId, userId),
            eq(serviceBookings.status, "pending"),
          ),
        );
      return (rentalRow?.n ?? 0) + (bookingRow?.n ?? 0);
    } catch (error) {
      this.handleError(error, "countPendingOwnedRequests");
    }
  }

  /**
   * Security-deposit holds that are live. `scheduled`/`held` only — a `failed`
   * or `release_failed` hold does not block (D-E2-8).
   */
  async countActiveDepositHolds(userId: string): Promise<number> {
    try {
      const [row] = await this.db
        .select({ n: count() })
        .from(rentalPaymentLifecycle)
        .innerJoin(rentals, eq(rentalPaymentLifecycle.rentalId, rentals.id))
        .where(
          and(
            eq(rentals.renterId, userId),
            inArray(rentalPaymentLifecycle.depositHoldStatus, [
              ...BLOCKING_DEPOSIT_STATUSES,
            ]),
          ),
        );
      return row?.n ?? 0;
    } catch (error) {
      this.handleError(error, "countActiveDepositHolds");
    }
  }

  /**
   * Payouts owed to the user that have not settled — as rental owner or service
   * provider. Blocks on `pending`/`processing` payout and `pending`/`processing`/
   * `frozen` transfer; `failed` does not block (D-E2-8). `frozen` means an open
   * dispute is holding the money, which the dispute blocker also catches, but
   * counting it here keeps the class self-contained.
   */
  async countIncompletePayouts(userId: string): Promise<number> {
    try {
      const [rentalRow] = await this.db
        .select({ n: count() })
        .from(rentalPaymentLifecycle)
        .innerJoin(rentals, eq(rentalPaymentLifecycle.rentalId, rentals.id))
        .where(
          and(
            eq(rentals.ownerId, userId),
            or(
              inArray(rentalPaymentLifecycle.payoutStatus, [
                ...BLOCKING_PAYOUT_STATUSES,
              ]),
              inArray(rentalPaymentLifecycle.ownerTransferStatus, [
                ...BLOCKING_TRANSFER_STATUSES,
              ]),
            ),
          ),
        );
      const [serviceRow] = await this.db
        .select({ n: count() })
        .from(servicePaymentLifecycle)
        .innerJoin(
          serviceBookings,
          eq(servicePaymentLifecycle.bookingId, serviceBookings.id),
        )
        .where(
          and(
            eq(serviceBookings.providerId, userId),
            or(
              inArray(servicePaymentLifecycle.payoutStatus, [
                ...BLOCKING_PAYOUT_STATUSES,
              ]),
              inArray(servicePaymentLifecycle.ownerTransferStatus, [
                ...BLOCKING_TRANSFER_STATUSES,
              ]),
            ),
          ),
        );
      return (rentalRow?.n ?? 0) + (serviceRow?.n ?? 0);
    } catch (error) {
      this.handleError(error, "countIncompletePayouts");
    }
  }

  /**
   * Unresolved disputes involving the user.
   *
   * `disputes` has no `againstUserId` — only `createdBy` and an XOR'd
   * `rentalId`/`serviceBookingId` (F25) — so "involving this user" is a 3-way
   * reach: they filed it, OR it is on a rental of theirs (either side), OR on a
   * booking of theirs (either side). Blocks on `open`/`evidence_requested`/
   * `under_review`.
   */
  async countOpenDisputes(userId: string): Promise<number> {
    try {
      const [row] = await this.db
        .select({ n: count() })
        .from(disputes)
        .where(
          and(
            inArray(disputes.status, [...BLOCKING_DISPUTE_STATUSES]),
            or(
              eq(disputes.createdBy, userId),
              sql`EXISTS (
                SELECT 1 FROM ${rentals} r
                WHERE r.id = ${disputes.rentalId}
                  AND (r.renter_id = ${userId} OR r.owner_id = ${userId})
              )`,
              sql`EXISTS (
                SELECT 1 FROM ${serviceBookings} sb
                WHERE sb.id = ${disputes.serviceBookingId}
                  AND (sb.requester_id = ${userId} OR sb.provider_id = ${userId})
              )`,
            ),
          ),
        );
      return row?.n ?? 0;
    } catch (error) {
      this.handleError(error, "countOpenDisputes");
    }
  }

  /**
   * Anonymize a user in a single transaction and return the Stripe payment
   * method ids that still need detaching.
   *
   * **Anonymize, never destroy** (gotcha #7): `payments`, `rentals`, `disputes`,
   * `audit_logs` and their lifecycle rows are retained keyed to the now-scrubbed
   * user id, satisfying the financial/audit retention constraint. Nothing here
   * calls `userDAL.deleteUser` — that is the admin hard-delete that cascades
   * financial rows away (F21).
   *
   * Stripe PM detach is intentionally **not** done here — it is a non-
   * transactional external call, so it must not be able to roll back committed
   * DB state (or be rolled back by a later failure). The ids are returned for
   * the service to detach best-effort after the transaction commits.
   *
   * Requirements: 2.5.1
   * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.6.2
   */
  async anonymizeUser(userId: string): Promise<{ paymentMethodIds: string[] }> {
    try {
      return await this.db.transaction(async (tx) => {
        const existing = await tx
          .select({ id: user.id })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1);
        if (existing.length === 0) {
          throw new NotFoundError("User", userId);
        }

        // Stripe PM ids are read inside the txn but detached outside it.
        const pmRows = await tx
          .select({ stripeId: userPaymentMethods.stripePaymentMethodId })
          .from(userPaymentMethods)
          .where(eq(userPaymentMethods.userId, userId));

        // Scrub PII. `name`/`email` are NOT NULL, so they get collision-free
        // tombstones rather than null; the rest are nullable and cleared.
        // `email` must be unique, so it is keyed on the (immutable, unique) id.
        await tx
          .update(user)
          .set({
            name: "Deleted User",
            email: `deleted+${userId}@deleted.hoador.invalid`,
            image: null,
            firstName: null,
            lastName: null,
            phone: null,
            bio: null,
            profileImageUrl: null,
            status: "inactive",
            anonymizedAt: new Date(),
            // stripeCustomerId / stripeConnectedAccountId are kept: pseudonymous
            // keys still needed for refunds/chargebacks inside the retention
            // window.
            updatedAt: new Date(),
          })
          .where(eq(user.id, userId));

        // Hard-delete rows that carry PII and have no retention value.
        await tx.delete(userAddresses).where(eq(userAddresses.userId, userId));
        // Sessions + credentials: revoke by deletion (no admin plugin needed).
        await tx.delete(session).where(eq(session.userId, userId));
        await tx.delete(account).where(eq(account.userId, userId));

        // Deactivate device + card records (retain rows; drop reachability).
        await tx
          .update(pushSubscriptions)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(pushSubscriptions.userId, userId),
              eq(pushSubscriptions.isActive, true),
            ),
          );
        await tx
          .update(userPaymentMethods)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(userPaymentMethods.userId, userId));

        // Delist content from discovery.
        await tx
          .update(listings)
          .set({ status: "inactive", updatedAt: new Date() })
          .where(eq(listings.ownerId, userId));
        await tx
          .update(serviceListings)
          .set({ status: "inactive", updatedAt: new Date() })
          .where(eq(serviceListings.providerId, userId));
        await tx
          .update(neighborhoodNeeds)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(neighborhoodNeeds.createdByUserId, userId),
              sql`${neighborhoodNeeds.deletedAt} IS NULL`,
            ),
          );

        return {
          paymentMethodIds: pmRows
            .map((r) => r.stripeId)
            .filter((id): id is string => Boolean(id)),
        };
      });
    } catch (error) {
      this.handleError(error, "anonymizeUser");
    }
  }
}
