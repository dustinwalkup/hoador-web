import Stripe from "stripe";

import { PLATFORM_FEE_PERCENTAGE } from "@/constants/payments";

import { PAYMENT_SERVER_INSTANCE } from "./server";
import { isRetryablePaymentError } from "./rental-payments";

/**
 * Metadata for a service booking charge (Stripe metadata values are strings).
 */
export interface ChargeServicePaymentMetadata {
  paymentType: "service_charge";
  bookingId: string;
  /** Listing id for the booked service */
  serviceId: string;
  providerId: string;
  requesterId: string;
}

/**
 * Parameters to capture payment when a provider accepts a service booking.
 * Idempotency key format: `service-charge-{bookingId}`.
 */
export interface ChargeServicePaymentParams {
  customerId: string;
  paymentMethodId: string;
  /** Charge amount in dollars (service price + platform service fee as applicable). */
  amount: number;
  metadata: ChargeServicePaymentMetadata;
  idempotencyKey: string;
}

/**
 * Successful charge result: PaymentIntent and the Charge id for later transfer/refund.
 */
export interface ChargeServicePaymentResult {
  paymentIntent: Stripe.PaymentIntent;
  /** `paymentIntent.latest_charge` as string (source_transaction for Connect transfer). */
  chargeId: string;
}

/**
 * Parameters for transferring net service revenue to the provider Connect account.
 * Idempotency key format: `service-transfer-{bookingId}`.
 */
export interface CreateServiceTransferParams {
  bookingId: string;
  providerConnectedAccountId: string;
  /** Stripe Charge id (`ch_*`) used as `source_transaction`. */
  chargeId: string;
  /**
   * Service price in dollars (gross before platform cut). Used when
   * {@link CreateServiceTransferParams.providerPayoutAmount} is omitted.
   */
  servicePrice?: number;
  /**
   * Locked net payout in dollars (e.g. from DB at charge time). When set, transfer uses
   * this amount and skips recomputing from {@link servicePrice} and platform fee.
   */
  providerPayoutAmount?: number;
  idempotencyKey: string;
}

export type ServiceTransferResult =
  | { success: true; transferId: string }
  | { success: false; error: string };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Runs an async op once; on retryable Stripe errors, waits 1s and retries once.
 */
async function withPaymentRetry<T>(
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isRetryablePaymentError(error)) {
      throw error;
    }
    await delay(1000);
    try {
      return await fn();
    } catch (retryError) {
      console.error(
        `${operation}: retry after retryable error failed`,
        retryError,
      );
      throw retryError;
    }
  }
}

/**
 * Reads Charge id from a confirmed PaymentIntent.
 */
function chargeIdFromPaymentIntent(
  paymentIntent: Stripe.PaymentIntent,
): string {
  const latest = paymentIntent.latest_charge;
  if (typeof latest === "string" && latest.length > 0) {
    return latest;
  }
  if (latest && typeof latest === "object" && "id" in latest && latest.id) {
    return latest.id;
  }
  throw new Error("PaymentIntent missing latest_charge after confirmation");
}

/**
 * Creates and confirms an off-session PaymentIntent for a service booking.
 * Funds remain on the platform account (no `transfer_data`). Platform payout uses
 * {@link createServiceTransfer} after the job completes.
 */
export async function chargeServicePayment(
  params: ChargeServicePaymentParams,
): Promise<ChargeServicePaymentResult> {
  const { customerId, paymentMethodId, amount, metadata, idempotencyKey } =
    params;

  const meta: Record<string, string> = {
    paymentType: metadata.paymentType,
    bookingId: metadata.bookingId,
    serviceId: metadata.serviceId,
    providerId: metadata.providerId,
    requesterId: metadata.requesterId,
  };

  const paymentIntent = await withPaymentRetry("chargeServicePayment", () =>
    PAYMENT_SERVER_INSTANCE.paymentIntents.create(
      {
        amount: Math.round(amount * 100),
        currency: "usd",
        customer: customerId,
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true,
        capture_method: "automatic",
        metadata: meta,
      },
      { idempotencyKey },
    ),
  );

  return {
    paymentIntent,
    chargeId: chargeIdFromPaymentIntent(paymentIntent),
  };
}

/**
 * Transfers net service amount to the provider's Connect account using the original charge
 * as `source_transaction`.
 *
 * If `providerPayoutAmount` is set, transfer cents = `round(providerPayoutAmount * 100)`.
 * Otherwise transfer cents =
 * `round(servicePrice * 100) - round(servicePrice * 100 * PLATFORM_FEE_PERCENTAGE)`.
 */
export async function createServiceTransfer(
  params: CreateServiceTransferParams,
): Promise<ServiceTransferResult> {
  let transferAmountCents: number;
  if (params.providerPayoutAmount != null) {
    transferAmountCents = Math.round(params.providerPayoutAmount * 100);
  } else if (params.servicePrice != null) {
    const grossCents = Math.round(params.servicePrice * 100);
    const platformFeeCents = Math.round(
      params.servicePrice * 100 * PLATFORM_FEE_PERCENTAGE,
    );
    transferAmountCents = grossCents - platformFeeCents;
  } else {
    return {
      success: false,
      error: "Either servicePrice or providerPayoutAmount is required",
    };
  }

  if (transferAmountCents <= 0) {
    return {
      success: false,
      error: "Transfer amount must be positive after platform fee",
    };
  }

  try {
    const transfer = await withPaymentRetry("createServiceTransfer", () =>
      PAYMENT_SERVER_INSTANCE.transfers.create(
        {
          amount: transferAmountCents,
          currency: "usd",
          destination: params.providerConnectedAccountId,
          source_transaction: params.chargeId,
          metadata: {
            bookingId: params.bookingId,
          },
        },
        { idempotencyKey: params.idempotencyKey },
      ),
    );

    return { success: true, transferId: transfer.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown transfer error";
    console.error("createServiceTransfer:", message);
    return { success: false, error: message };
  }
}
