/**
 * A single reason a listing cannot be deleted yet, shaped for the client to
 * render directly.
 *
 * `type` is a stable code the app branches on; `message` is a human-readable
 * fallback; `count` lets the app say "2 active rentals".
 *
 * Mirrors `AccountDeletionBlocker` deliberately — same shape, same contract, so
 * a client that already renders one blocker list renders this one unchanged.
 */
export type ListingDeletionBlocker = {
  type: "active_rentals" | "pending_requests";
  count: number;
  message: string;
};

/**
 * Thrown when deleting a rental listing is refused because rentals are still in
 * flight against it. Routes translate this to HTTP 409 with body
 * `{ error: "LISTING_DELETION_BLOCKED", blockers: [...] }`.
 *
 * **Why this guard exists at all.** `listingDAL.deleteListing` is a plain
 * `DELETE FROM listings`, and the foreign keys cascade:
 *
 *   listings → rental_requests → rentals → rental_payment_lifecycle
 *                                        → rental_agreement_documents
 *
 * so deleting a listing mid-rental destroyed the rental, its payment lifecycle
 * record and its signed agreement — while the Stripe-side money (a captured
 * charge, a live deposit hold) stayed exactly where it was, now with nothing in
 * this database pointing at it. The service side has always had the equivalent
 * protection (`service_bookings.listing_id` is ON DELETE RESTRICT and
 * `DELETE /api/services/listings/[id]` refuses when bookings exist); rentals
 * were simply missed.
 *
 * Structurally mirrors `AccountDeletionBlockedError`: a standalone `Error` (not
 * a `DALError`) carrying a typed `details` payload, with a dedicated
 * `handleApiError` branch and a spot on that function's Sentry-capture
 * exclusion list — a blocked delete is an expected user outcome, not an
 * incident.
 *
 * Requirements: mobile Req 7.1.4
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-10-manage-listings-ai.md
 *       § F1 / D-E10-1 / P-E10-1
 */
export class ListingDeletionBlockedError extends Error {
  public readonly code = "LISTING_DELETION_BLOCKED";
  public readonly statusCode = 409;

  constructor(public readonly details: { blockers: ListingDeletionBlocker[] }) {
    super("Listing deletion is blocked by rentals in flight");
    this.name = "ListingDeletionBlockedError";
  }
}
