import { disputeDAL, rentalDAL } from "@/dal";
import type { DisputeStatus } from "@/dal/types";
import { TimeWindowValidation } from "./time-window-validation";

/**
 * Whether this viewer can file a dispute on this transaction, decided
 * server-side (P-E13-7).
 *
 * ## Why the server has to answer this
 *
 * There was no endpoint for it. The web detail page calls
 * `TimeWindowValidation.isDisputeFilingWindowOpen(startDate, returnConfirmedAt)`
 * in a React component to decide whether to render "File a dispute" — a copy of
 * the rule, in a client, that nothing keeps in step with the server's. The
 * mobile app would have needed a second copy, in a binary that cannot be
 * hot-fixed, and its rule #1 says eligibility is not the client's to compute.
 *
 * The filing call remains authoritative: a client that offers the action anyway
 * gets `DISPUTE_WINDOW_CLOSED` or `DISPUTE_ALREADY_EXISTS` with the same
 * reasoning attached (P-E13-3). This is what lets the UI avoid *offering* an
 * action that will be refused.
 *
 * ## The window is the unified one
 *
 * ⚠️ Not the per-reason-code table in Req 19.1.2 and Appendix C. Rentals open at
 * `startDate` and close 24h after `returnConfirmedAt`; service bookings open on
 * the scheduled calendar day and close 24h after `completedAt`, or 24h after the
 * scheduled time when the booking was never completed. See the epic plan's F12 —
 * `TimeWindowValidation.calculateDeadline` implements the documented policy and
 * no production path calls it.
 */
export interface DisputeFilingEligibility {
  /** Offer the "File a dispute" action. False for a non-party, always. */
  canFile: boolean;
  /**
   * When the window closes, ISO. Null when there is no deadline yet — a rental
   * that has not been returned — or when filing is impossible anyway.
   */
  filingWindowEndsAt: string | null;
  /**
   * The dispute that already exists, if one does. **One per transaction ever**
   * (the unique index on `disputes.rental_id` / `.service_booking_id`), so this
   * being set means `canFile` is false, whether that dispute is open or
   * long since resolved — which is why the status ships with it.
   */
  existingDisputeId: string | null;
  existingDisputeStatus: DisputeStatus | null;
}

const NOT_ELIGIBLE: DisputeFilingEligibility = {
  canFile: false,
  filingWindowEndsAt: null,
  existingDisputeId: null,
  existingDisputeStatus: null,
};

/**
 * Eligibility for a rental.
 *
 * @param rentalId - `rentals.id`, or null when the request was never approved
 *   into a rental (nothing to dispute yet)
 * @param isParty - whether the viewer is the renter or the owner; an admin
 *   reading someone else's rental is neither
 */
export async function rentalDisputeEligibility(
  rentalId: string | null,
  isParty: boolean,
): Promise<DisputeFilingEligibility> {
  if (!rentalId || !isParty) return NOT_ELIGIBLE;

  const [existing, window] = await Promise.all([
    disputeDAL.getAnyByRentalId(rentalId),
    disputeDAL.validateFilingWindowUnified(rentalId),
  ]);

  if (existing) {
    return {
      canFile: false,
      filingWindowEndsAt: window.deadline?.toISOString() ?? null,
      existingDisputeId: existing.id,
      existingDisputeStatus: existing.status,
    };
  }

  return {
    canFile: window.valid,
    filingWindowEndsAt: window.deadline?.toISOString() ?? null,
    existingDisputeId: null,
    existingDisputeStatus: null,
  };
}

/**
 * Eligibility for a service booking.
 *
 * The status gate mirrors `DisputeCreationService.createServiceBookingDispute`:
 * only `accepted` and `completed` bookings can be disputed — there is nothing to
 * dispute about a request nobody accepted.
 *
 * The creation service has one branch this cannot mirror, deliberately: when a
 * booking was never marked complete and its scheduled time has passed, filing is
 * **allowed** and an ops alert is raised (its S12 case). Reproducing that here
 * would mean raising an ops alert on every page view, so the window check is the
 * stricter of the two and the filing call is where the exception lives.
 */
export async function serviceBookingDisputeEligibility(
  booking: {
    id: string;
    status: string;
    proposedDate: string | Date;
    proposedTime: string;
    completedAt: Date | null;
  },
  isParty: boolean,
): Promise<DisputeFilingEligibility> {
  if (!isParty) return NOT_ELIGIBLE;

  const existing = await disputeDAL.getAnyByServiceBookingId(booking.id);

  const proposedDate =
    typeof booking.proposedDate === "string"
      ? booking.proposedDate
      : booking.proposedDate.toISOString().slice(0, 10);

  const window = TimeWindowValidation.validateServiceFilingWindow(
    proposedDate,
    booking.proposedTime,
    booking.completedAt,
  );
  const filingWindowEndsAt = window.deadline?.toISOString() ?? null;

  if (existing) {
    return {
      canFile: false,
      filingWindowEndsAt,
      existingDisputeId: existing.id,
      existingDisputeStatus: existing.status,
    };
  }

  const disputableStatus =
    booking.status === "accepted" || booking.status === "completed";

  return {
    canFile: disputableStatus && window.valid,
    filingWindowEndsAt,
    existingDisputeId: null,
    existingDisputeStatus: null,
  };
}

/**
 * Resolve the `rentals.id` behind a rental-detail read.
 *
 * `/api/rentals/[id]` is addressed by the **request** id, and disputes hang off
 * `rentals.id` — the two-table split. Returns null when the request was never
 * approved, which is also the answer to "can this be disputed" (it cannot).
 */
export async function resolveRentalIdForDispute(detail: {
  type: string;
  id: string;
}): Promise<string | null> {
  if (detail.type !== "request") return detail.id;
  const rental = await rentalDAL.getRentalByRequestId(detail.id);
  return rental?.id ?? null;
}
