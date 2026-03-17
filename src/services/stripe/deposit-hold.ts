import {
  authorizeSecurityDeposit,
  releaseSecurityDeposit,
} from "./rental-payments";

interface PlaceDepositHoldParams {
  rentalId: string;
  customerId: string;
  paymentMethodId: string;
  amount: number; // in dollars
  metadata: {
    rentalRequestId: string;
    rentalId: string;
    listingId: string;
    renterId: string;
  };
}

type DepositHoldResult =
  | { success: true; paymentIntentId: string }
  | { success: false; error: string };

/**
 * Place an authorization hold for a security deposit.
 * Uses deterministic idempotency key: deposit-hold-{rentalId}.
 */
export async function placeDepositHold(
  params: PlaceDepositHoldParams,
): Promise<DepositHoldResult> {
  try {
    const idempotencyKey = `deposit-hold-${params.rentalId}`;

    const paymentIntent = await authorizeSecurityDeposit(
      params.customerId,
      params.paymentMethodId,
      params.amount,
      {
        type: "security_deposit",
        rentalRequestId: params.metadata.rentalRequestId,
        listingId: params.metadata.listingId,
        renterId: params.metadata.renterId,
      },
      idempotencyKey,
    );

    return { success: true, paymentIntentId: paymentIntent.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown deposit hold error";
    console.error("Error placing deposit hold:", message);
    return { success: false, error: message };
  }
}

/**
 * Release (cancel) a previously placed deposit hold.
 * Reuses the existing releaseSecurityDeposit function.
 */
export async function releaseDepositHold(
  paymentIntentId: string,
): Promise<void> {
  await releaseSecurityDeposit(paymentIntentId);
}
