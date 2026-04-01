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
