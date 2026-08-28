/**
 * Who may cancel a rental, and in what state — the rules `cancelRental` has
 * always enforced, lifted out so the **preview** and the **action** cannot
 * disagree (mobile D-E8A-3, P-E8A-3).
 *
 * Pure, and deliberately in `lib/` rather than beside the cancellation service:
 * the preview route must be able to answer "can this be cancelled, and for how
 * much" without importing Stripe, the deposit-release path or the notification
 * pipeline. Req 9.3.1 requires the refund tier to be shown **before** the
 * confirm dialog opens, and a read that drags the whole write path behind it is
 * how that requirement quietly becomes a write.
 */

export type CancellationBlockCode =
  | "NOT_A_PARTY"
  | "OWNER_MUST_DECLINE"
  | "ACTIVE_RENTAL"
  | "NOT_CANCELLABLE";

export type CancellationEligibility =
  | {
      canCancel: true;
      cancelledBy: "renter" | "owner";
      path: "pending" | "approved";
    }
  | { canCancel: false; code: CancellationBlockCode; message: string };

/**
 * Assess a cancellation attempt.
 *
 * The messages are the ones `cancelRental` throws, to the character, because the
 * same strings reach the user from both paths — the preview explains why the
 * button is unavailable, and the action explains why it refused.
 */
export function assessCancellation(
  rental: { status: string; renterId: string; ownerId: string },
  userId: string,
): CancellationEligibility {
  const isRenter = rental.renterId === userId;
  const isOwner = rental.ownerId === userId;

  if (!isRenter && !isOwner) {
    return {
      canCancel: false,
      code: "NOT_A_PARTY",
      message: "You are not authorized to cancel this rental",
    };
  }

  if (rental.status === "pending") {
    // The owner's route out of a pending request is **decline**, which requires
    // a reason the renter is told (Req 10.1.5). Letting them cancel instead
    // would be the same outcome with no explanation attached.
    return isRenter
      ? { canCancel: true, cancelledBy: "renter", path: "pending" }
      : {
          canCancel: false,
          code: "OWNER_MUST_DECLINE",
          message: "Only the renter can cancel a pending request",
        };
  }

  if (rental.status === "approved") {
    return {
      canCancel: true,
      cancelledBy: isRenter ? "renter" : "owner",
      path: "approved",
    };
  }

  // Req 9.3.1: an active rental cannot be cancelled at all — early return is not
  // a proration, and there is no refund tier for it to fall into.
  if (rental.status === "active") {
    return {
      canCancel: false,
      code: "ACTIVE_RENTAL",
      message: "Cancellation not allowed for active rentals",
    };
  }

  return {
    canCancel: false,
    code: "NOT_CANCELLABLE",
    message: "Rental cannot be cancelled in its current status",
  };
}

/** The refund tiers of Req 9.3.1, as a value the client renders rather than derives. */
export type RefundTier =
  /** Pre-approval: nothing was ever charged. */
  | "pending_no_charge"
  /** ≥24h before pickup: rental price refunded, service fee retained. */
  | "full_refund_24h"
  /** <24h before pickup: half the rental price refunded, service fee retained. */
  | "half_refund_under_24h"
  /** The owner cancelling an approved rental: the renter is made whole. */
  | "owner_cancellation"
  /** No tier applies — the rental cannot be cancelled. */
  | "unavailable";

/** The boundary Req 9.3.1's approved-rental tiers hinge on. */
export const REFUND_TIER_HOURS = 24;

/**
 * Hours from `now` until pickup, on the same arithmetic
 * `calculateRenterCancellationRefund` uses.
 *
 * Deliberately identical rather than merely equivalent: if the preview rounded
 * or floored differently, a renter shown "100% refund" could be charged the 50%
 * tier moments later, which is precisely the surprise Req 9.3.1 exists to
 * prevent.
 */
export function hoursUntilPickup(
  startDate: Date,
  now: Date = new Date(),
): number {
  return (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);
}

/**
 * When the quoted tier stops being true, or `null` if it is already the last one.
 *
 * The preview is a snapshot. Without this a renter can sit on the screen across
 * the 24-hour boundary and confirm against a tier that expired while they read
 * it; with it the client can refetch or count down.
 */
export function refundTierExpiresAt(
  startDate: Date,
  now: Date = new Date(),
): string | null {
  const boundary = new Date(
    startDate.getTime() - REFUND_TIER_HOURS * 60 * 60 * 1000,
  );
  return boundary.getTime() > now.getTime() ? boundary.toISOString() : null;
}

/** The tier for an eligible cancellation. */
export function refundTierFor(
  eligibility: CancellationEligibility,
  startDate: Date,
  now: Date = new Date(),
): RefundTier {
  if (!eligibility.canCancel) return "unavailable";
  if (eligibility.path === "pending") return "pending_no_charge";
  if (eligibility.cancelledBy === "owner") return "owner_cancellation";
  return hoursUntilPickup(startDate, now) >= REFUND_TIER_HOURS
    ? "full_refund_24h"
    : "half_refund_under_24h";
}
