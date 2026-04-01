import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  requireAuthResponse,
  getCurrentUserId,
} from "@/lib/api/route-helpers";
import { serviceBookingDAL, servicePaymentLifecycleDAL } from "@/dal";

/**
 * GET /api/services/bookings/[id]/payment-lifecycle
 * Payment lifecycle for a booking (requester or provider only).
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

    const { data: booking, error: bookingError } = await tryCatch(
      serviceBookingDAL.getById(id),
    );

    if (bookingError) {
      return handleApiError(bookingError);
    }

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.requesterId !== userId && booking.providerId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: lifecycle, error: lifecycleError } = await tryCatch(
      servicePaymentLifecycleDAL.getByBookingId(id),
    );

    if (lifecycleError) {
      return handleApiError(lifecycleError);
    }

    if (!lifecycle) {
      return NextResponse.json(
        { error: "Payment lifecycle not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(lifecycle);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/services/bookings/[id]/payment-lifecycle",
);
