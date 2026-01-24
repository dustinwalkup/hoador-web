import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { tryCatch } from "@walkup/walkup-utils";

import {
  requireAdminResponse,
  handleApiError,
  getCurrentUserId,
} from "@/lib/api/route-helpers";
import { listingDAL } from "@/dal";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import {
  generateListingApprovalEmailHtml,
  generateListingApprovalEmailText,
} from "@/features/notifications/utils/email-templates";
import { db } from "@/db/db";
import { user } from "@/db/schemas/user.schema";

/**
 * Approve a listing
 * Requires admin authentication
 */
export async function POST(
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
    const { error: updateError } = await tryCatch(
      listingDAL.updateApprovalStatus(listingId, "approved", adminId),
    );

    if (updateError) {
      return handleApiError(updateError);
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
    const garageUrl = `${baseUrl}/dashboard/garage`;

    const ownerName = ownerUser.firstName || "there";

    // Send notification (in-app + email)
    await sendNotification({
      userId: listing.owner.id,
      type: "listing_approved",
      title: "Listing Approved",
      message: `Your listing "${listing.name}" has been approved and is now live!`,
      data: {
        listingId: listing.id,
        listingName: listing.name,
      },
      linkUrl: garageUrl,
      email: {
        to: ownerUser.email,
        subject: `Your listing "${listing.name}" has been approved`,
        html: generateListingApprovalEmailHtml({
          ownerName,
          listingName: listing.name,
          garageUrl,
          baseUrl,
        }),
        text: generateListingApprovalEmailText({
          ownerName,
          listingName: listing.name,
          garageUrl,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
