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
 * Idempotency: `refund-rental-{rentalId}` or `refund-service-{serviceBookingId}`.
 *
 * @param params - Exactly one of rentalId or serviceBookingId must be set.
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

    const idempotencyKey = hasService
      ? `refund-service-${params.serviceBookingId}`
      : `refund-rental-${params.rentalId}`;

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
