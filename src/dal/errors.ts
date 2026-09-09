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
