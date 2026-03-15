import { PAYMENT_SERVER_INSTANCE } from "./server";

interface ProcessRefundParams {
  rentalId: string;
  /** Stripe Charge ID (from rentalChargeId on lifecycle record). */
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
 * Uses deterministic idempotency key: refund-rental-{rentalId}.
 *
 * @param params - Refund parameters (rentalId, chargeId, amount in cents, reason)
 * @returns Success with refund ID, or failure with error message
 */
export async function processRefund(
  params: ProcessRefundParams,
): Promise<RefundResult> {
  try {
    const idempotencyKey = `refund-rental-${params.rentalId}`;

    const refund = await PAYMENT_SERVER_INSTANCE.refunds.create(
      {
        charge: params.chargeId,
        amount: params.refundAmountCents,
        metadata: {
          rentalId: params.rentalId,
          reason: params.reason,
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
