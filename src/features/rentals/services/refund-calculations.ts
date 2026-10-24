import { PLATFORM_FEE_PERCENTAGE } from "@/constants/payments";
import {
  hoursUntilPickup,
  REFUND_TIER_HOURS,
} from "@/features/rentals/lib/cancellation-eligibility";

export interface RefundCalculation {
  refundAmountCents: number;
  ownerTransferAmountCents: number;
  refundReason: string;
}

/**
 * Refund calculation for renter-initiated cancellation.
 * >=24h before pickup: full rental price refund, 0 owner transfer.
 * <24h: 50% rental price refund, owner receives (50% − platform fee).
 *
 * `startDate` is the stored booked day. Pickup is the start of that day in the
 * market zone, measured by `hoursUntilPickup`: the same function the
 * cancellation preview quotes its tier and `tierExpiresAt` from (HOA-124).
 */
export function calculateRenterCancellationRefund(
  rentalPriceDollars: number,
  startDate: Date,
  now: Date = new Date(),
): RefundCalculation {
  const rentalPriceCents = Math.round(rentalPriceDollars * 100);
  const platformFeeCents = Math.round(
    rentalPriceDollars * PLATFORM_FEE_PERCENTAGE * 100,
  );

  if (hoursUntilPickup(startDate, now) >= REFUND_TIER_HOURS) {
    return {
      refundAmountCents: rentalPriceCents,
      ownerTransferAmountCents: 0,
      refundReason: "renter_cancellation_24h",
    };
  }

  const halfRentalPriceCents = Math.round(rentalPriceCents / 2);
  const retainedCents = rentalPriceCents - halfRentalPriceCents;
  const ownerTransferCents = retainedCents - platformFeeCents;

  return {
    refundAmountCents: halfRentalPriceCents,
    ownerTransferAmountCents: Math.max(ownerTransferCents, 0),
    refundReason: "renter_cancellation_under_24h",
  };
}

/**
 * Full charge refund for owner-initiated cancellation; no owner transfer.
 */
export function calculateOwnerCancellationRefund(
  totalChargeDollars: number,
): RefundCalculation {
  return {
    refundAmountCents: Math.round(totalChargeDollars * 100),
    ownerTransferAmountCents: 0,
    refundReason: "owner_cancellation",
  };
}

/**
 * No-show refund: renter no-show = 50% refund + owner transfer; owner no-show = full refund.
 */
export function calculateNoShowRefund(
  rentalPriceDollars: number,
  totalChargeDollars: number,
  noShowType: "renter_no_show" | "owner_no_show",
): RefundCalculation {
  if (noShowType === "owner_no_show") {
    return {
      refundAmountCents: Math.round(totalChargeDollars * 100),
      ownerTransferAmountCents: 0,
      refundReason: "owner_no_show",
    };
  }

  const rentalPriceCents = Math.round(rentalPriceDollars * 100);
  const halfRentalPriceCents = Math.round(rentalPriceCents / 2);
  const retainedCents = rentalPriceCents - halfRentalPriceCents;
  const platformFeeCents = Math.round(
    rentalPriceDollars * PLATFORM_FEE_PERCENTAGE * 100,
  );
  const ownerTransferCents = retainedCents - platformFeeCents;

  return {
    refundAmountCents: halfRentalPriceCents,
    ownerTransferAmountCents: Math.max(ownerTransferCents, 0),
    refundReason: "renter_no_show",
  };
}
