import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import { auditLogDAL } from "@/dal";
import { RentalDAL } from "@/dal/rentals.dal";
import {
  handleApiError,
  captureNonCriticalError,
  requireAuthResponse,
  getClientIP,
  getUserAgent,
} from "@/lib/api/route-helpers";
import { trackActivity } from "@/features/activity/lib/track-activity";
import { sendRentalEndedNotification } from "@/features/rentals/notifications/rental-ended";
import { z } from "zod";
import { parseFormData } from "@/lib/api/route-helpers";
import { sanitizeTextWithMaxLength } from "@/lib/utils/sanitize";

const CONDITION_MAX_LENGTH = 2000;
const MAX_DAMAGE_PHOTOS = 10;

/**
 * The return condition and optional damage report (mobile Req 10.2.3).
 *
 * `damagePhotos` are blob URLs already uploaded through
 * `POST /api/rentals/[id]/damage-photos` — this route never handles file bytes,
 * so a slow upload cannot hold the return confirmation open.
 *
 * A damage report requires a description: "damaged, no further comment" starts
 * a dispute the other party cannot answer.
 */
const endRentalSchema = z
  .object({
    conditionAtReturn: z.string().max(CONDITION_MAX_LENGTH).optional(),
    damageReported: z.boolean().optional(),
    damageDescription: z.string().max(CONDITION_MAX_LENGTH).optional(),
    damagePhotos: z.array(z.string().url()).max(MAX_DAMAGE_PHOTOS).optional(),
  })
  .refine((data) => !data.damageReported || !!data.damageDescription?.trim(), {
    message: "Describe the damage you're reporting",
    path: ["damageDescription"],
  });

/**
 * POST /api/rentals/[id]/end
 * End a rental (active → completed)
 * Only the owner can end active rentals
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

    // Optional body: an empty POST stays a valid "returned, nothing to note",
    // which is how the web client has always called this route.
    const rawBody = await parseFormData(request).catch(() => ({}));
    const parsed = endRentalSchema.safeParse(rawBody ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: issue?.message || "Invalid data provided" },
        { status: 400 },
      );
    }
    const clean = (value: string | undefined) =>
      value?.trim()
        ? sanitizeTextWithMaxLength(value.trim(), CONDITION_MAX_LENGTH)
        : undefined;
    const endInput = {
      conditionAtReturn: clean(parsed.data.conditionAtReturn),
      damageReported: parsed.data.damageReported,
      damageDescription: clean(parsed.data.damageDescription),
      damagePhotos: parsed.data.damagePhotos,
    };

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

    // Authorization check: only owner can end rentals
    if (rentalRequest.ownerId !== currentUserId) {
      return NextResponse.json(
        { error: "Forbidden: Only the listing owner can end rentals" },
        { status: 403 },
      );
    }

    // End the rental and get details for notification
    const { data: result, error } = await tryCatch(
      rentalDAL.endRental(rentalId, currentUserId, endInput),
    );

    if (error) {
      return handleApiError(error);
    }

    if (!result) {
      return NextResponse.json(
        { error: "Failed to end rental" },
        { status: 500 },
      );
    }

    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);
    await auditLogDAL.create({
      entityType: "rental_request",
      entityId: rentalId,
      action: "rental_request.return_confirmed",
      userId: currentUserId,
      metadata: { listingId: rentalRequest.listingId },
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
    });

    trackActivity(currentUserId, "rental_completed", {
      rentalId,
      rentalRequestId: rentalId,
    });

    // Send notification to renter
    try {
      await sendRentalEndedNotification({
        userId: result.rental.renterId,
        renterName: result.renterName,
        ownerName: result.ownerName,
        listingName: result.listingName,
        rentalId: rentalId,
      });
    } catch (notificationError) {
      captureNonCriticalError(notificationError, {
        route: "POST /api/rentals/[id]/end",
        action: "send_rental_ended_notification",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/rentals/[id]/end",
);
