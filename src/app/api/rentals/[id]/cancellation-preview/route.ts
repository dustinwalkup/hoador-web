import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";

import { rentalDAL } from "@/dal";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import {
  assessCancellation,
  hoursUntilPickup,
  refundTierExpiresAt,
  refundTierFor,
} from "@/features/rentals/lib/cancellation-eligibility";
import {
  calculateOwnerCancellationRefund,
  calculateRenterCancellationRefund,
} from "@/features/rentals/services/refund-calculations";

const money = (cents: number) => (cents / 100).toFixed(2);

/**
 * GET /api/rentals/[id]/cancellation-preview
 *
 * What cancelling would cost, **before** the confirm dialog opens (mobile
 * Req 9.3.1, decision D-E8A-3, prerequisite P-E8A-3).
 *
 * ## Why a read, and why the server
 *
 * Req 9.3.1's tiers hinge on *hours until pickup*. That is a deadline, and a
 * client that computes one against its own clock will eventually show a renter
 * "100% refund" for a cancellation the server charges 50% for — a device an hour
 * fast is all it takes. So the tier, the amounts and the eligibility all come
 * from here, and the app renders them.
 *
 * Nothing new is calculated. This route runs `assessCancellation` — the same
 * function `cancelRental` now runs — and the same
 * `calculate*CancellationRefund` the action uses. It simply stops before the
 * side effects: no refund, no deposit release, no notifications.
 *
 * ## `tierExpiresAt`
 *
 * The answer is a snapshot. A renter can sit on this screen while the 24-hour
 * boundary passes underneath them, so the response says when the quoted tier
 * stops being true and the client refetches rather than confirming against a
 * number it was shown ten minutes ago.
 *
 * ## Status codes
 *
 * **200 with `canCancel: false`** for a rental that cannot be cancelled — that
 * is the answer being asked for, and the reason is the useful part. 403 is kept
 * for a non-party, who should not learn a rental's state at all; 404 for one
 * that does not exist.
 */
async function getHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const { id } = await params;

    const { data: request, error } = await tryCatch(
      rentalDAL.getRentalRequestById(id, userId),
    );
    if (error) return handleApiError(error);
    if (!request) {
      return NextResponse.json({ error: "Rental not found" }, { status: 404 });
    }

    const eligibility = assessCancellation(request, userId);

    // A stranger is told nothing about this rental, not even that it cannot be
    // cancelled — the preview must not become a state oracle.
    if (!eligibility.canCancel && eligibility.code === "NOT_A_PARTY") {
      return NextResponse.json({ error: eligibility.message }, { status: 403 });
    }

    const now = new Date();
    const startDate = new Date(request.startDate);
    const tier = refundTierFor(eligibility, startDate, now);

    if (!eligibility.canCancel) {
      return NextResponse.json({
        canCancel: false,
        reason: eligibility.message,
        code: eligibility.code,
        tier,
        hoursUntilPickup: hoursUntilPickup(startDate, now),
      });
    }

    // Pending: no charge was ever made, so there is nothing to refund and no
    // money read to do (Req 9.3.1). `getRentalCancellationContext` inner-joins
    // `rentals`, which does not exist yet at this stage anyway.
    if (eligibility.path === "pending") {
      return NextResponse.json({
        canCancel: true,
        cancelledBy: eligibility.cancelledBy,
        tier,
        reason: null,
        refundAmount: "0.00",
        nonRefundable: "0.00",
        rentalPrice: null,
        serviceFee: null,
        totalCharged: "0.00",
        hoursUntilPickup: hoursUntilPickup(startDate, now),
        tierExpiresAt: null,
        depositHoldStatus: null,
        depositWillBeReleased: false,
      });
    }

    const { data: ctx } = await tryCatch(
      rentalDAL.getRentalCancellationContext(id),
    );
    if (!ctx) {
      // Approved with no rental row is a shape the data should not hold. Say so
      // rather than quoting a refund from figures we could not read.
      return NextResponse.json(
        { error: "Cancellation details are unavailable for this rental" },
        { status: 409 },
      );
    }

    const rentalPriceDollars = parseFloat(ctx.rentalPrice);
    const totalChargeDollars = parseFloat(ctx.totalChargeAmount);

    const calc =
      eligibility.cancelledBy === "owner"
        ? calculateOwnerCancellationRefund(totalChargeDollars)
        : calculateRenterCancellationRefund(
            rentalPriceDollars,
            ctx.startDate,
            now,
          );

    // The service fee is what the renter does not get back on their own
    // cancellation, and does get back when the owner cancels (Req 9.3.1/9.3.3).
    // Derived from the charge and the refund rather than restated, so it cannot
    // disagree with the number above it.
    const nonRefundableCents =
      Math.round(totalChargeDollars * 100) - calc.refundAmountCents;

    return NextResponse.json({
      canCancel: true,
      cancelledBy: eligibility.cancelledBy,
      tier,
      reason: null,
      refundAmount: money(calc.refundAmountCents),
      nonRefundable: money(Math.max(nonRefundableCents, 0)),
      rentalPrice: rentalPriceDollars.toFixed(2),
      serviceFee: parseFloat(ctx.serviceFee).toFixed(2),
      totalCharged: totalChargeDollars.toFixed(2),
      hoursUntilPickup: hoursUntilPickup(ctx.startDate, now),
      tierExpiresAt: refundTierExpiresAt(ctx.startDate, now),
      /** A hold is released, never "refunded" — it was never a charge (rule #4). */
      depositHoldStatus: ctx.depositHoldStatus,
      depositWillBeReleased: ctx.depositHoldStatus === "held",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/rentals/[id]/cancellation-preview",
);
