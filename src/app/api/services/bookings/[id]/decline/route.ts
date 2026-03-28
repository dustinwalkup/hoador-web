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
import { declineServiceBookingSchema } from "@/features/services/lib/service-api-schemas";
import { ServiceBookingService } from "@/features/services/services/service-booking-service";

/**
 * POST /api/services/bookings/[id]/decline
 * Provider declines a pending booking (reason required).
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
    const parsed = declineServiceBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);

    const { error } = await tryCatch(
      ServiceBookingService.declineBooking(id, userId, parsed.data.reason, {
        ipAddress,
        userAgent,
      }),
    );

    if (error) {
      return handleApiError(error);
    }

    return NextResponse.json({ status: "declined" as const });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/services/bookings/[id]/decline",
);
