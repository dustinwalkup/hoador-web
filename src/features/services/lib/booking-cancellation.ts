/**
 * Who may cancel a service booking, on what terms, and for how much — the rules
 * `cancelBooking` has always enforced, lifted out so the **preview** and the
 * **action** cannot disagree (mobile D-E9-3, P-E9-2).
 *
 * Pure, and in `lib/` rather than beside the booking service, so the preview
 * route can answer "can this be cancelled, and what comes back" without
 * importing Stripe, the transfer path or the notification pipeline. Req 11.1.5
 * requires the consequences to be shown **before** the confirm, and a read that
 * drags the whole write path behind it is how that quietly becomes a write.
 *
 * ⚠️ **The service tiers are not the rental tiers, and the copy is not
 * transferable.** Two differences do real work:
 *
 *  - **The refund base changes with the tier.** A partial refund is computed on
 *    `servicePrice` (the service fee is kept); a full refund is computed on
 *    `totalAmount` (the fee comes back). So "50%" is not half of what "100%"
 *    returns — it is half of a *smaller* number.
 *  - **A provider cancellation is always a full refund**, whenever it happens,
 *    and a client cancelling inside 24 hours triggers a **provider transfer**
 *    of the retained share that neither side is otherwise told about.
 */

import { PLATFORM_FEE_PERCENTAGE } from "@/constants/payments";
import { wallClockToInstant } from "@/lib/wall-clock-zone";

export type BookingCancellationBlockCode =
  | "NOT_A_PARTY"
  | "NOT_CANCELLABLE"
  | "ACTIVE_DISPUTE";

export type BookingCancellationEligibility =
  | {
      canCancel: true;
      cancelledBy: "requester" | "provider";
      /** `pending` was never charged; `accepted` was. */
      path: "pending" | "accepted";
    }
  | { canCancel: false; code: BookingCancellationBlockCode; message: string };

/**
 * Assess a cancellation attempt.
 *
 * The messages are the ones `cancelBooking` throws, to the character, because
 * the same strings reach the user from both paths — the preview explains why
 * the button is unavailable, the action explains why it refused.
 *
 * `hasActiveDispute` is passed in rather than read here: eligibility is a pure
 * function of facts, and which of those facts needs a database is the caller's
 * problem.
 */
export function assessServiceCancellation(
  booking: { status: string; requesterId: string; providerId: string },
  userId: string,
  hasActiveDispute = false,
): BookingCancellationEligibility {
  const isRequester = booking.requesterId === userId;
  const isProvider = booking.providerId === userId;

  if (!isRequester && !isProvider) {
    return {
      canCancel: false,
      code: "NOT_A_PARTY",
      message: "You cannot cancel this booking",
    };
  }

  if (booking.status !== "pending" && booking.status !== "accepted") {
    return {
      canCancel: false,
      code: "NOT_CANCELLABLE",
      message: "Booking cannot be cancelled",
    };
  }

  if (hasActiveDispute) {
    return {
      canCancel: false,
      code: "ACTIVE_DISPUTE",
      message:
        "Cannot cancel a booking with an active dispute. Resolve the dispute first.",
    };
  }

  return {
    canCancel: true,
    cancelledBy: isRequester ? "requester" : "provider",
    path: booking.status === "pending" ? "pending" : "accepted",
  };
}

/** The refund tiers of Req 11.1.5, as a value the client renders rather than derives. */
export type ServiceRefundTier =
  /** Pre-acceptance: nothing was ever charged. */
  | "pending_no_charge"
  /** >24h before the job: service price and fee both refunded. */
  | "full_refund_24h"
  /** ≤24h before the job: half the service price; the service fee is kept. */
  | "half_refund_under_24h"
  /** The provider cancelling: the client is made whole, whenever it happens. */
  | "provider_cancellation"
  /** Accepted but never charged — nothing to give back. */
  | "no_charge_on_record"
  /** No tier applies — the booking cannot be cancelled. */
  | "unavailable";

/** The boundary Req 11.1.5's tiers hinge on. */
export const SERVICE_REFUND_TIER_HOURS = 24;

/**
 * When the job is, as a real instant.
 *
 * `null` when the stored wall clock cannot be read. Callers must treat that as
 * *unknown*, never as *now*: the old implementation returned `new Date()` on a
 * parse failure, which silently quoted the harshest tier for a booking whose
 * time was merely unreadable.
 */
export function serviceInstant(booking: {
  proposedDate: string | Date;
  proposedTime: string;
}): Date | null {
  const date =
    booking.proposedDate instanceof Date
      ? booking.proposedDate.toISOString().slice(0, 10)
      : booking.proposedDate;
  return wallClockToInstant(date, booking.proposedTime);
}

/** Hours from `now` until the job, or `null` when the job time cannot be read. */
export function hoursUntilService(
  serviceAt: Date | null,
  now: Date = new Date(),
): number | null {
  if (!serviceAt) return null;
  return (serviceAt.getTime() - now.getTime()) / (1000 * 60 * 60);
}

/**
 * When the quoted tier stops being true, or `null` if it is already the last one.
 *
 * The preview is a snapshot. Without this a client can sit on the screen across
 * the 24-hour boundary and confirm against a tier that expired while they read
 * it — and on this lifecycle that is the difference between all of their money
 * and half of the smaller number.
 */
export function serviceTierExpiresAt(
  serviceAt: Date | null,
  now: Date = new Date(),
): string | null {
  if (!serviceAt) return null;
  const boundary = new Date(
    serviceAt.getTime() - SERVICE_REFUND_TIER_HOURS * 60 * 60 * 1000,
  );
  return boundary.getTime() > now.getTime() ? boundary.toISOString() : null;
}

/**
 * The tier for an eligible cancellation.
 *
 * `hoursUntil === null` (an unreadable job time) resolves to the **generous**
 * tier, not the harsh one. The client is not at fault for a value the server
 * stored, and a support conversation about an over-refund is a better failure
 * than one about money taken on the strength of a string nobody could parse.
 */
export function serviceRefundTierFor(
  eligibility: BookingCancellationEligibility,
  hoursUntil: number | null,
  hasCharge: boolean,
): ServiceRefundTier {
  if (!eligibility.canCancel) return "unavailable";
  if (eligibility.path === "pending") return "pending_no_charge";
  if (!hasCharge) return "no_charge_on_record";
  if (eligibility.cancelledBy === "provider") return "provider_cancellation";
  return hoursUntil === null || hoursUntil > SERVICE_REFUND_TIER_HOURS
    ? "full_refund_24h"
    : "half_refund_under_24h";
}

export interface ServiceRefundBreakdown {
  tier: ServiceRefundTier;
  /** Integer cents, so the split never rides on a float. */
  refundCents: number;
  nonRefundableCents: number;
  /**
   * What the provider is transferred when a client cancels inside 24 hours —
   * the retained half less the platform's cut. Zero on every other tier.
   *
   * Surfaced because it is real money moving on a cancellation, and today
   * neither party is told it happens.
   */
  providerTransferCents: number;
}

const cents = (dollars: string) => Math.round(Number(dollars) * 100);

/**
 * What cancelling actually pays back, in cents.
 *
 * The fractions and bases here are `cancelBooking`'s, unchanged — this is the
 * extraction, not a redesign. What is new is that a *read* can now ask the
 * question, so the number a client confirms against is the number they were
 * shown (D-E9-3).
 */
export function serviceRefundBreakdown(
  tier: ServiceRefundTier,
  amounts: { servicePrice: string; totalAmount: string },
): ServiceRefundBreakdown {
  const servicePriceCents = cents(amounts.servicePrice);
  const totalCents = cents(amounts.totalAmount);

  if (tier === "pending_no_charge" || tier === "no_charge_on_record") {
    return {
      tier,
      refundCents: 0,
      nonRefundableCents: 0,
      providerTransferCents: 0,
    };
  }

  if (tier === "full_refund_24h" || tier === "provider_cancellation") {
    // The full tiers refund `totalAmount` — the service fee comes back too.
    return {
      tier,
      refundCents: totalCents,
      nonRefundableCents: 0,
      providerTransferCents: 0,
    };
  }

  if (tier === "half_refund_under_24h") {
    // The partial tier is computed on `servicePrice` alone: the service fee is
    // retained, which is why this is NOT half of what the full tier returns.
    const refundCents = Math.round(servicePriceCents * 0.5);
    return {
      tier,
      refundCents,
      nonRefundableCents: Math.max(totalCents - refundCents, 0),
      // 50% retained, less the platform's 20% — `cancelBooking`'s own
      // `servicePrice * (refundFraction - PLATFORM_FEE_PERCENTAGE)`.
      providerTransferCents: Math.max(
        Math.round(servicePriceCents * (0.5 - PLATFORM_FEE_PERCENTAGE)),
        0,
      ),
    };
  }

  return {
    tier,
    refundCents: 0,
    nonRefundableCents: totalCents,
    providerTransferCents: 0,
  };
}
