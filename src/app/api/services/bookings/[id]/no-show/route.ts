import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  requireAuthResponse,
  parseFormData,
  getCurrentUserId,
} from "@/lib/api/route-helpers";
import { noShowServiceBookingSchema } from "@/features/services/lib/service-api-schemas";
import { sanitizeTextWithMaxLength } from "@/lib/utils/sanitize";
import { ServiceBookingService } from "@/features/services/services/service-booking-service";

const NOTES_MAX = 2000;

/**
 * POST /api/services/bookings/[id]/no-show
 * Report a no-show for an accepted booking.
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
    const parsed = noShowServiceBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const notesRaw = parsed.data.notes?.trim();
    const notes = notesRaw
      ? sanitizeTextWithMaxLength(notesRaw, NOTES_MAX)
      : undefined;

    const { error } = await tryCatch(
      ServiceBookingService.reportNoShow(id, userId, notes),
    );

    if (error) {
      return handleApiError(error);
    }

    return NextResponse.json({ reported: true as const });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/services/bookings/[id]/no-show",
);
