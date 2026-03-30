import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";

import {
  requireAdminResponse,
  handleApiError,
  parseFormData,
  getCurrentUserId,
} from "@/lib/api/route-helpers";
import { listingDAL } from "@/dal";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import {
  generateListingRejectionEmailHtml,
  generateListingRejectionEmailText,
} from "@/features/notifications/utils/email-templates";
import { rejectionReasonSchema } from "@/features/admin/schemas/listing-review.schema";
import { db } from "@/db/db";
import { user } from "@/db/schemas/user.schema";
import { eq } from "drizzle-orm";

/**
 * Reject a listing
 * Requires admin authentication
 */
async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    // Require admin authentication
    const adminError = await requireAdminResponse();
    if (adminError) {
      return adminError;
    }

    const { listingId } = await params;

    // Parse request body
    const body = await parseFormData(request);
    const { rejectionReason } = body;

    // Validate rejection reason
    if (!rejectionReason || typeof rejectionReason !== "string") {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 },
      );
    }

    const validationResult = rejectionReasonSchema.safeParse(rejectionReason);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error:
            validationResult.error.issues[0]?.message ||
            "Invalid rejection reason",
        },
        { status: 400 },
      );
    }

    const sanitizedReason = validationResult.data;

    // Get listing details before updating (to get owner info for notification)
    const listing = await listingDAL.getListingById(listingId);

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Get owner email
    const ownerUser = await db.query.user.findFirst({
      where: eq(user.id, listing.owner.id),
      columns: {
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!ownerUser) {
      return NextResponse.json(
        { error: "Listing owner not found" },
        { status: 404 },
      );
    }

    // Get admin ID
    const adminId = await getCurrentUserId();
    if (!adminId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Update approval status
    const { data: updateResult, error: updateError } = await tryCatch(
      listingDAL.updateApprovalStatus(
        listingId,
        "rejected",
        adminId,
        sanitizedReason,
      ),
    );

    if (updateError) {
      return handleApiError(updateError);
    }

    // Idempotent: listing was already rejected (e.g. retry after network error)
    if (!updateResult?.updated) {
      return NextResponse.json({ success: true });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
    const garageUrl = `${baseUrl}/dashboard/listings/rentals`;

    const ownerName = ownerUser.firstName || "there";

    // Send notification (in-app + email)
    await sendNotification({
      userId: listing.owner.id,
      type: "listing_rejected",
      title: "Listing Needs Changes",
      message: `Your listing "${listing.name}" requires changes before it can be approved.`,
      data: {
        listingId: listing.id,
        listingName: listing.name,
        rejectionReason: sanitizedReason,
      },
      linkUrl: garageUrl,
      email: {
        to: ownerUser.email,
        subject: `Your listing "${listing.name}" needs changes`,
        html: generateListingRejectionEmailHtml({
          ownerName,
          listingName: listing.name,
          rejectionReason: sanitizedReason,
          garageUrl,
          baseUrl,
        }),
        text: generateListingRejectionEmailText({
          ownerName,
          listingName: listing.name,
          rejectionReason: sanitizedReason,
          garageUrl,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/admin/listings/[listingId]/reject",
);
