import { PAYMENT_SERVER_INSTANCE } from "./server";

interface CreateOwnerTransferParams {
  rentalId: string;
  rentalRequestId: string;
  ownerId: string;
  ownerConnectedAccountId: string;
  rentalChargeId: string; // Stripe Charge ID for source_transaction
  ownerPayoutAmount: number; // in dollars — precomputed owner payout amount
  retryCount?: number; // incremented by admin reset — changes idempotency key
}

type TransferResult =
  | { success: true; transferId: string }
  | { success: false; error: string };

/**
 * Create a manual transfer to the owner's connected account.
 * Uses the precomputed owner payout amount from rental request pricing.
 * Uses deterministic idempotency key: transfer-owner-{rentalId}.
 */
export async function createOwnerTransfer(
  params: CreateOwnerTransferParams,
): Promise<TransferResult> {
  try {
    const retryCount = params.retryCount ?? 0;
    const idempotencyKey =
      retryCount > 0
        ? `transfer-owner-${params.rentalId}-retry-${retryCount}`
        : `transfer-owner-${params.rentalId}`;
    const transferAmountCents = Math.round(params.ownerPayoutAmount * 100);

    const transfer = await PAYMENT_SERVER_INSTANCE.transfers.create(
      {
        amount: transferAmountCents,
        currency: "usd",
        destination: params.ownerConnectedAccountId,
        source_transaction: params.rentalChargeId,
        metadata: {
          rentalId: params.rentalId,
          rentalRequestId: params.rentalRequestId,
          ownerId: params.ownerId,
        },
      },
      { idempotencyKey },
    );

    return { success: true, transferId: transfer.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown transfer error";
    console.error("Error creating owner transfer:", message);
    return { success: false, error: message };
  }
}
