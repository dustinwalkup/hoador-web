export class DALError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode = 500,
  ) {
    super(message);
    this.name = "DALError";
  }
}

export class NotFoundError extends DALError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      "NOT_FOUND",
      404,
    );
  }
}

export class ValidationError extends DALError {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message, "VALIDATION_ERROR", 400);
  }
}

export class ForbiddenError extends DALError {
  constructor(message = "Forbidden") {
    super(message, "FORBIDDEN", 403);
  }
}

export class ConflictError extends DALError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

/**
 * Thrown when a service booking accept charge fails after status was set to
 * `payment_failed`. API responses include `paymentFailed: true` in the JSON body.
 */
export class ServiceBookingPaymentFailedError extends DALError {
  constructor(message: string) {
    super(message, "SERVICE_BOOKING_PAYMENT_FAILED", 400);
    this.name = "ServiceBookingPaymentFailedError";
  }
}

/**
 * Thrown when a user sends into a conversation they have archived. API
 * responses include `code: "CONVERSATION_ARCHIVED"` so a client can offer
 * "unarchive to reply" instead of parsing the prose message (mobile rule #8).
 *
 * Not a `ConflictError` subclass on purpose: it needs its own `handleApiError`
 * branch to emit the code, and the generic `ConflictError` branch would
 * otherwise claim it first.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-11-messaging.md § F14 / P-E11-1
 */
export class ConversationArchivedError extends DALError {
  constructor(
    message = "Cannot send messages to an archived conversation. Please unarchive to continue.",
  ) {
    super(message, "CONVERSATION_ARCHIVED", 409);
    this.name = "ConversationArchivedError";
  }
}

/**
 * Thrown when an owner approves a rental request that is no longer pending
 * (cancelled, declined, expired, or already approved). Raised BEFORE any Stripe
 * call: approval used to check only the payment claim, so a stale owner screen
 * could charge the renter for a request that no longer existed (BIZ-01).
 *
 * `code: "REQUEST_NOT_PENDING"` lets a client refresh the request instead of
 * parsing the message. Not a `ConflictError` subclass, for the same reason as
 * `ConversationArchivedError`: the generic branch would drop the code.
 */
export class RentalRequestNotPendingError extends DALError {
  constructor(
    message = "This rental request is no longer pending and cannot be approved.",
  ) {
    super(message, "REQUEST_NOT_PENDING", 409);
    this.name = "RentalRequestNotPendingError";
  }
}

/**
 * Thrown when an owner approves a rental request whose dates another request
 * for the same listing already holds: approved, active or overdue, or pending
 * with its charge in flight. Raised BEFORE the charge. Availability used to be
 * checked only when a request was created, and pending requests never block
 * each other, so an owner could approve two overlapping requests and charge
 * two renters for one item (CONC-01).
 *
 * `code: "DATES_UNAVAILABLE"` is the quote blocker code the create/preview
 * flow already returns, so a client needs no new branch. Not a
 * `ConflictError` subclass, for the same reason as `RentalRequestNotPendingError`.
 */
export class RentalDatesUnavailableError extends DALError {
  constructor(
    message = "Those dates are no longer available for this listing.",
  ) {
    super(message, "DATES_UNAVAILABLE", 409);
    this.name = "RentalDatesUnavailableError";
  }
}

/**
 * Thrown when a provider marks a service booking complete before its scheduled
 * instant. Completing early paid the provider for work not yet done and could
 * leave the requester an empty dispute window (BIZ-02).
 *
 * `code: "SERVICE_NOT_YET_DUE"` lets a client explain the wait instead of
 * parsing the message. Not a `ConflictError` subclass, for the same reason as
 * `ConversationArchivedError`: the generic branch would drop the code.
 */
export class ServiceNotYetDueError extends DALError {
  constructor(
    message = "This service hasn't happened yet — you can mark it complete on or after the scheduled date.",
  ) {
    super(message, "SERVICE_NOT_YET_DUE", 409);
    this.name = "ServiceNotYetDueError";
  }
}

/**
 * Thrown when approving/accepting would charge someone whose account is gone:
 * self-deleted (anonymized) or otherwise not `active`. They can no longer log
 * in to see, dispute or cancel the charge (BIZ-07).
 *
 * `code: "COUNTERPARTY_UNAVAILABLE"`; not a `ConflictError` subclass, for the
 * same reason as `RentalRequestNotPendingError`.
 */
export class CounterpartyUnavailableError extends DALError {
  constructor(message = "The other party's account is no longer active.") {
    super(message, "COUNTERPARTY_UNAVAILABLE", 409);
    this.name = "CounterpartyUnavailableError";
  }
}

/**
 * Thrown when a user posts a Neighborhood Need past the posting limits: too
 * many open at once, or too many in the last 24 hours. Every post notifies the
 * poster's whole network, so an unthrottled poster could spam every member
 * (SEC-15).
 *
 * 429 with `code: "NEED_LIMIT_REACHED"`: mobile classifies any 429 as
 * rate-limited. Not a `ConflictError` subclass, for the same reason as
 * `RentalRequestNotPendingError`.
 */
export class NeedLimitReachedError extends DALError {
  constructor(message: string) {
    super(message, "NEED_LIMIT_REACHED", 429);
    this.name = "NeedLimitReachedError";
  }
}

/**
 * Thrown by `enforceRateLimit` (src/lib/api/rate-limit.ts) once a key exceeds
 * its window (ARCH-07). `handleApiError` adds a `Retry-After` header alongside
 * the usual `{error, code}` body; mobile classifies any 429 as rate-limited.
 */
export class RateLimitedError extends DALError {
  constructor(
    public readonly retryAfterSeconds: number,
    message = "Too many requests. Please try again later.",
  ) {
    super(message, "RATE_LIMITED", 429);
    this.name = "RateLimitedError";
  }
}

/**
 * A standing cap on active push subscriptions per user (SEC-13): unlimited
 * endpoints is what made `/api/push/test` usable as an HTTPS reflector.
 */
export class SubscriptionLimitReachedError extends DALError {
  constructor(message: string) {
    super(message, "SUBSCRIPTION_LIMIT_REACHED", 429);
    this.name = "SubscriptionLimitReachedError";
  }
}

/**
 * Thrown when a user tries to open a conversation with themselves. Req 16.1.3
 * says 1:1 conversations are between two *different* people; until this class
 * existed only the UI enforced it, and a self-pair row would have made every
 * "am I user1 or user2" branch in the messages DAL take the user1 arm.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-11-messaging.md § F16 / P-E11-5
 */
export class CannotMessageSelfError extends DALError {
  constructor(message = "You cannot start a conversation with yourself") {
    super(message, "CANNOT_MESSAGE_SELF", 400);
    this.name = "CannotMessageSelfError";
  }
}

/**
 * Hiding the primary (home) community is refused (R4.5). Mobile P-E14-6 asked
 * for a stable code so the visibility screen can branch on it, not the prose.
 */
export class VisibilityPrimaryLockedError extends DALError {
  constructor(message = "You can't hide your home community.") {
    super(message, "VISIBILITY_PRIMARY_LOCKED", 400);
    this.name = "VisibilityPrimaryLockedError";
  }
}

/**
 * A listing failed an eligibility check at quote, or its re-check at
 * approve/accept time (BIZ-08). One base class so `handleApiError` needs one
 * branch for the family — same pattern as `DisputeError`. 409 with a stable
 * `code`, the same codes the quote endpoints return as blockers.
 */
export abstract class ListingEligibilityError extends Error {
  abstract readonly code: string;
  readonly statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export function isListingEligibilityError(
  error: unknown,
): error is ListingEligibilityError {
  return error instanceof ListingEligibilityError;
}

/** Listing `status` is not one of the bookable states. */
export class ListingNotBookableError extends ListingEligibilityError {
  readonly code = "LISTING_NOT_BOOKABLE";
  constructor(message = "This listing isn't available for booking right now.") {
    super(message);
  }
}

/** Rental listing `isActive = false` (archived by its owner). */
export class ListingArchivedError extends ListingEligibilityError {
  readonly code = "LISTING_ARCHIVED";
  constructor(message = "This listing has been removed by its owner.") {
    super(message);
  }
}

/** Rental listing `approvalStatus !== "approved"`. */
export class ListingNotApprovedError extends ListingEligibilityError {
  readonly code = "LISTING_NOT_APPROVED";
  constructor(message = "This listing hasn't been approved yet.") {
    super(message);
  }
}

/** Either party is not visible in the listing's community (the symmetric R5 rule). */
export class CommunityNotVisibleError extends ListingEligibilityError {
  readonly code = "COMMUNITY_NOT_VISIBLE";
  constructor(message = "This listing isn't visible to you right now.") {
    super(message);
  }
}
