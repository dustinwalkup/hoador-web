import { PAYMENT_SERVER_INSTANCE } from "./server";

export interface ProcessRefundParams {
  /** Rental flow: set with Stripe charge id from lifecycle. */
  rentalId?: string;
  /** Service booking flow: set with Stripe charge id from booking. */
  serviceBookingId?: string;
  /** Stripe Charge ID (e.g. ch_xxx). */
  chargeId: string;
  refundAmountCents: number;
  reason: string;
  metadata?: Record<string, string>;
}

type RefundResult =
  | { success: true; refundId: string }
  | { success: false; error: string };

/**
 * Process a refund via Stripe.
 * Idempotency keys include charge id and amount so retries use the same key for
 * identical requests, but a different refund amount (e.g. after a calculation fix)
 * does not collide with Stripe’s stored first attempt.
 */
export async function processRefund(
  params: ProcessRefundParams,
): Promise<RefundResult> {
  try {
    const hasRental =
      params.rentalId != null && String(params.rentalId).length > 0;
    const hasService =
      params.serviceBookingId != null &&
      String(params.serviceBookingId).length > 0;
    if (hasRental === hasService) {
      return {
        success: false,
        error: "Exactly one of rentalId or serviceBookingId is required",
      };
    }

    const amountPart = String(params.refundAmountCents);
    const idempotencyKey = hasService
      ? `refund-service-${params.serviceBookingId}-${params.chargeId}-${amountPart}`
      : `refund-rental-${params.rentalId}-${params.chargeId}-${amountPart}`;

    const refund = await PAYMENT_SERVER_INSTANCE.refunds.create(
      {
        charge: params.chargeId,
        amount: params.refundAmountCents,
        metadata: {
          reason: params.reason,
          ...(hasService
            ? { serviceBookingId: params.serviceBookingId! }
            : { rentalId: params.rentalId! }),
          ...params.metadata,
        },
      },
      { idempotencyKey },
    );

    return { success: true, refundId: refund.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown refund error";
    console.error("Error processing refund:", message);
    return { success: false, error: message };
  }
}
