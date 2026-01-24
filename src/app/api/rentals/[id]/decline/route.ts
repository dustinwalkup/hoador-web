import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { tryCatch } from "@walkup/walkup-utils";
import { rentalDAL, userDAL } from "@/dal";
import {
  handleApiError,
  parseFormData,
  requireAuthResponse,
} from "@/lib/api/route-helpers";
import { sendRentalDeniedNotification } from "@/features/rentals/notifications/rental-denied";

const declineRequestSchema = z.object({
  denialReason: z.string().min(1, "Denial reason is required"),
});

/**
 * POST /api/rentals/[id]/decline
 * Decline a rental request
 */
export async function POST(
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
          console.error("Failed to send rental denied notification:", err);
        });
      }
    } catch (notificationError) {
      console.error(
        "Error sending rental denied notification:",
        notificationError,
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
