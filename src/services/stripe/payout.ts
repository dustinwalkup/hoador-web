import { PAYMENT_SERVER_INSTANCE } from "./server";

interface CreateOwnerTransferParams {
  rentalId: string;
  rentalRequestId: string;
  ownerId: string;
  ownerConnectedAccountId: string;
  rentalChargeId: string; // Stripe Charge ID for source_transaction
  totalAmount: number; // in dollars — the rental charge amount
  platformFeePercentage: number; // e.g. 0.2
}

type TransferResult =
  | { success: true; transferId: string }
  | { success: false; error: string };

/**
 * Create a manual transfer to the owner's connected account.
 * Platform fee is deducted from the transfer amount.
 * Uses deterministic idempotency key: transfer-owner-{rentalId}.
 */
export async function createOwnerTransfer(
  params: CreateOwnerTransferParams,
): Promise<TransferResult> {
  try {
    const idempotencyKey = `transfer-owner-${params.rentalId}`;

    const totalAmountCents = Math.round(params.totalAmount * 100);
    const platformFeeCents = Math.round(
      params.totalAmount * params.platformFeePercentage * 100,
    );
    const transferAmountCents = totalAmountCents - platformFeeCents;

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
