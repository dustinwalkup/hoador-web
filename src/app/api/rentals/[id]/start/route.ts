import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import { RentalDAL } from "@/dal/rentals.dal";
import {
  handleApiError,
  captureNonCriticalError,
  requireAuthResponse,
} from "@/lib/api/route-helpers";
import { sendRentalStartedNotification } from "@/features/rentals/notifications/rental-started";
import { z } from "zod";
import { parseFormData } from "@/lib/api/route-helpers";
import { sanitizeTextWithMaxLength } from "@/lib/utils/sanitize";

const CONDITION_MAX_LENGTH = 2000;

/**
 * The pickup condition (mobile Req 10.2.1).
 *
 * Optional: an owner handing over a ladder in obvious condition should not be
 * forced to type a paragraph about it. The column has existed all along and no
 * route accepted it until now (mobile P-E8A-6).
 */
const startRentalSchema = z.object({
  conditionAtPickup: z.string().max(CONDITION_MAX_LENGTH).optional(),
});

/**
 * POST /api/rentals/[id]/start
 * Start a rental (approved → active)
 * Only the owner can start approved rentals on or after the start date
 */
async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Check authentication
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const { id: rentalId } = await params;

    // A body is optional here — an empty POST is a valid "started, nothing to
    // note", which is how the web client has always called this route.
    const rawBody = await parseFormData(request).catch(() => ({}));
    const parsed = startRentalSchema.safeParse(rawBody ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data provided" },
        { status: 400 },
      );
    }
    const conditionAtPickup = parsed.data.conditionAtPickup?.trim()
      ? sanitizeTextWithMaxLength(
          parsed.data.conditionAtPickup.trim(),
          CONDITION_MAX_LENGTH,
        )
      : undefined;

    // Get current user ID for authorization
    const { getCurrentUserId } = await import("@/features/auth/utils/session");
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Fetch rental request to verify ownership
    const rentalDAL = new RentalDAL();
    const { data: rentalRequest, error: fetchError } = await tryCatch(
      rentalDAL.getRentalRequestById(rentalId, currentUserId),
    );

    if (fetchError || !rentalRequest) {
      return NextResponse.json(
        { error: fetchError?.message || "Rental request not found" },
        { status: 404 },
      );
    }

    // Authorization check: only owner can start rentals
    if (rentalRequest.ownerId !== currentUserId) {
      return NextResponse.json(
        { error: "Forbidden: Only the listing owner can start rentals" },
        { status: 403 },
      );
    }

    // Start the rental and get details for notification
    const { data: result, error } = await tryCatch(
      rentalDAL.startRental(rentalId, currentUserId, { conditionAtPickup }),
    );

    if (error) {
      return handleApiError(error);
    }

    if (!result) {
      return NextResponse.json(
        { error: "Failed to start rental" },
        { status: 500 },
      );
    }

    // Send notification to renter
    try {
      await sendRentalStartedNotification({
        userId: result.rental.renterId,
        renterName: result.renterName,
        ownerName: result.ownerName,
        listingName: result.listingName,
        rentalId: rentalId,
      });
    } catch (notificationError) {
      captureNonCriticalError(notificationError, {
        route: "POST /api/rentals/[id]/start",
        action: "send_rental_started_notification",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/rentals/[id]/start",
);
