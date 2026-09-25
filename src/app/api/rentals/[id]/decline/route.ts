import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { z } from "zod";
import { tryCatch } from "@walkup/walkup-utils";
import { rentalDAL, userDAL, auditLogDAL } from "@/dal";
import {
  handleApiError,
  captureNonCriticalError,
  parseFormData,
  requireAuthResponse,
  getClientIP,
  getUserAgent,
} from "@/lib/api/route-helpers";
import { trackActivity } from "@/features/activity/lib/track-activity";
import { sendRentalDeniedNotification } from "@/features/rentals/notifications/rental-denied";
import { sanitizeTextWithMaxLength } from "@/lib/utils/sanitize";

const DENIAL_REASON_MAX_LENGTH = 1000;

/**
 * The reason is stored and emailed to the renter, so it's sanitized like every
 * other free-text field (SEC-12), and the length rule runs on the sanitized
 * value, which markup-only input can empty. Over-long reasons are truncated,
 * not refused: neither client caps the input, and a 400 would lose the
 * owner's text.
 */
const declineRequestSchema = z.object({
  denialReason: z
    .string()
    .transform((reason) =>
      sanitizeTextWithMaxLength(reason.trim(), DENIAL_REASON_MAX_LENGTH),
    )
    .pipe(z.string().min(1, "Denial reason is required")),
});

/**
 * POST /api/rentals/[id]/decline
 * Decline a rental request
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

    // Parse request body
    const body = await parseFormData(request);

    // Validate input data
    const parseResult = declineRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid data provided" },
        { status: 400 },
      );
    }

    const validatedData = parseResult.data;

    // Get current user ID for authorization
    const { getCurrentUserId } = await import("@/features/auth/utils/session");
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Fetch rental request details before declining (for notification)
    const { data: rentalRequest, error: fetchError } = await tryCatch(
      rentalDAL.getRentalRequestById(rentalId, currentUserId),
    );

    if (fetchError || !rentalRequest) {
      return NextResponse.json(
        { error: fetchError?.message || "Rental request not found" },
        { status: 404 },
      );
    }

    // Authorization check: only owner can decline
    if (rentalRequest.ownerId !== currentUserId) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Only the listing owner can decline rental requests",
        },
        { status: 403 },
      );
    }

    const { error } = await tryCatch(
      rentalDAL.declineRentalRequest(
        rentalId,
        validatedData.denialReason,
        currentUserId,
      ),
    );

    if (error) {
      return handleApiError(error);
    }

    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);
    await auditLogDAL.create({
      entityType: "rental_request",
      entityId: rentalId,
      action: "rental_request.cancelled",
      userId: currentUserId,
      metadata: { declinedByOwner: true },
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
    });

    trackActivity(currentUserId, "rental_rejected", {
      rentalRequestId: rentalId,
    });

    // Send notification to renter (don't block on notification failure)
    try {
      const { data: renterUser } = await tryCatch(
        userDAL.getUserById(rentalRequest.renterId),
      );
      const { data: ownerUser } = await tryCatch(
        userDAL.getUserById(rentalRequest.ownerId),
      );

      if (renterUser && ownerUser) {
        await sendRentalDeniedNotification({
          userId: renterUser.id,
          to: renterUser.email,
          renterName: `${renterUser.firstName} ${renterUser.lastName}`,
          ownerName: `${ownerUser.firstName} ${ownerUser.lastName}`,
          listingName: rentalRequest.listingName,
          rentalId: rentalRequest.id,
          denialReason: validatedData.denialReason,
        }).catch((err) => {
          captureNonCriticalError(err, {
            route: "POST /api/rentals/[id]/decline",
            action: "send_rental_denied_notification",
          });
        });
      }
    } catch (notificationError) {
      captureNonCriticalError(notificationError, {
        route: "POST /api/rentals/[id]/decline",
        action: "send_denial_notifications",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/rentals/[id]/decline",
);
