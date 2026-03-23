import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  requireAuthResponse,
  getClientIP,
  getUserAgent,
  parseFormData,
  getCurrentUserId,
} from "@/lib/api/route-helpers";
import { cancelServiceBookingSchema } from "@/features/services/lib/service-api-schemas";
import { sanitizeTextWithMaxLength } from "@/lib/utils/sanitize";
import { ServiceBookingService } from "@/features/services/services/service-booking-service";

const CANCEL_REASON_MAX = 1000;

/**
 * POST /api/services/bookings/[id]/cancel
 * Requester or provider cancels; refunds may apply when charged.
 */
async function postHandler(
  request: NextRequest,
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
    const body = await parseFormData(request);
    const parsed = cancelServiceBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const reasonRaw = parsed.data.reason?.trim();
    const reason = reasonRaw
      ? sanitizeTextWithMaxLength(reasonRaw, CANCEL_REASON_MAX)
      : undefined;

    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);

    const { data, error } = await tryCatch(
      ServiceBookingService.cancelBooking(id, userId, reason, {
        ipAddress,
        userAgent,
      }),
    );

    if (error) {
      return handleApiError(error);
    }

    return NextResponse.json({
      status: "cancelled" as const,
      refundAmount: data.refundAmount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/services/bookings/[id]/cancel",
);
