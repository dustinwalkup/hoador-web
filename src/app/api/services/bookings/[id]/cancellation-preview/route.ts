import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";

import { disputeDAL, serviceBookingDAL } from "@/dal";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getCurrentUserId,
  handleApiError,
  requireAuthResponse,
} from "@/lib/api/route-helpers";
import {
  assessServiceCancellation,
  hoursUntilService,
  serviceInstant,
  serviceRefundBreakdown,
  serviceRefundTierFor,
  serviceTierExpiresAt,
} from "@/features/services/lib/booking-cancellation";

const money = (cents: number) => (cents / 100).toFixed(2);

/**
 * GET /api/services/bookings/[id]/cancellation-preview
 *
 * What cancelling would cost, **before** the confirm sheet opens (mobile
 * Req 11.1.5, decision D-E9-3, prerequisite P-E9-2).
 *
 * ## Why a read, and why the server
 *
 * The tiers hinge on *hours until the job*. That is a deadline, and a client
 * computing one against its own clock will eventually show "100% refund" for a
 * cancellation the server charges 50% for. So the tier, the amounts and the
 * eligibility all come from here and the app renders them.
 *
 * Nothing new is calculated. This runs `assessServiceCancellation`,
 * `serviceRefundTierFor` and `serviceRefundBreakdown` — the same three
 * functions `cancelBooking` now runs — and simply stops before the side
 * effects: no refund, no provider transfer, no notifications.
 *
 * ## The amounts are not the rental side's
 *
 * A full refund returns `totalAmount` (the service fee comes back); a half
 * refund is computed on `servicePrice` (the fee is kept). **"50%" is therefore
 * not half of what "100%" returns** — it is half of a smaller number, and the
 * response states both so the client never has to work that out.
 *
 * `providerTransfer` is the share the provider receives on a late client
 * cancellation. It is real money moving, and until now nobody was told it
 * happened.
 *
 * ## Status codes
 *
 * **200 with `canCancel: false`** for a booking that cannot be cancelled — that
 * is the answer being asked for, and the reason is the useful part. 403 is kept
 * for a non-party, who should not learn a booking's state at all; 404 for one
 * that does not exist.
 */
async function getHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = await params;

    const { data: booking, error } = await tryCatch(
      serviceBookingDAL.getById(id),
    );
    if (error) return handleApiError(error);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Only looked up for a party — a stranger must not be able to probe whether
    // a booking they cannot see has a dispute open on it.
    const isParty =
      booking.requesterId === userId || booking.providerId === userId;
    const { data: activeDispute } = isParty
      ? await tryCatch(disputeDAL.getActiveByServiceBookingId(id))
      : { data: null };

    const eligibility = assessServiceCancellation(
      booking,
      userId,
      Boolean(activeDispute),
    );

    // A stranger is told nothing about this booking, not even that it cannot be
    // cancelled — the preview must not become a state oracle.
    if (!eligibility.canCancel && eligibility.code === "NOT_A_PARTY") {
      return NextResponse.json({ error: eligibility.message }, { status: 403 });
    }

    const now = new Date();
    const serviceAt = serviceInstant(booking);
    const hoursUntil = hoursUntilService(serviceAt, now);
    const tier = serviceRefundTierFor(
      eligibility,
      hoursUntil,
      Boolean(booking.stripeChargeId),
    );

    if (!eligibility.canCancel) {
      return NextResponse.json({
        canCancel: false,
        code: eligibility.code,
        reason: eligibility.message,
        tier,
        hoursUntilService: hoursUntil,
      });
    }

    const breakdown = serviceRefundBreakdown(tier, booking);

    return NextResponse.json({
      canCancel: true,
      cancelledBy: eligibility.cancelledBy,
      tier,
      reason: null,
      refundAmount: money(breakdown.refundCents),
      nonRefundable: money(breakdown.nonRefundableCents),
      /** What the provider receives out of the retained amount, if anything. */
      providerTransfer: money(breakdown.providerTransferCents),
      servicePrice: booking.servicePrice,
      serviceFee: booking.serviceFee,
      totalCharged: booking.totalAmount,
      hoursUntilService: hoursUntil,
      // When the quoted tier stops being true, so a client sitting on the sheet
      // across the 24-hour boundary refetches instead of confirming against a
      // number they were shown ten minutes ago.
      tierExpiresAt: serviceTierExpiresAt(serviceAt, now),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/services/bookings/[id]/cancellation-preview",
);
