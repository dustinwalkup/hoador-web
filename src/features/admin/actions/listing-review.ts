"use server";
import { revalidatePath } from "next/cache";
import { tryCatch } from "@walkup/walkup-utils";

import { requireAdmin } from "@/features/auth/utils/guards";
import { listingDAL } from "@/dal";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import {
  generateListingApprovalEmailHtml,
  generateListingApprovalEmailText,
  generateListingRejectionEmailHtml,
  generateListingRejectionEmailText,
} from "@/features/notifications/utils/email-templates";
import { rejectionReasonSchema } from "@/features/admin/schemas/listing-review.schema";
import { db } from "@/db/db";
import { user } from "@/db/schemas/user.schema";
import { eq } from "drizzle-orm";

export interface ApproveListingState {
  success?: boolean;
  error?: string;
}

export interface RejectListingState {
  success?: boolean;
  error?: string;
}

/**
 * Approve a listing
 * Requires admin authentication
 */
export async function approveListingAction(
  listingId: string,
): Promise<ApproveListingState> {
  try {
    // Require admin authentication
    await requireAdmin();

    // Get listing details before updating (to get owner info for notification)
    const listing = await listingDAL.getListingById(listingId);

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
      return {
        error: "Listing owner not found",
      };
    }

    // Update approval status
    const { error: updateError } = await tryCatch(
      listingDAL.updateApprovalStatus(listingId, "approved"),
    );

    if (updateError) {
      return {
        error: updateError.message || "Failed to approve listing",
      };
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

    // Graceful degradation: notification sent even if revalidation fails
    try {
      revalidatePath("/admin/dashboard/listings/review");
      revalidatePath("/dashboard/garage");
    } catch (revalidateError) {
      console.error("Revalidation failed:", revalidateError);
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred while approving the listing";
    console.error("Error in approveListingAction:", error);
    return {
      error: errorMessage,
    };
  }
}

/**
 * Reject a listing
 * Requires admin authentication
 */
export async function rejectListingAction(
  listingId: string,
  rejectionReason: string,
): Promise<RejectListingState> {
  try {
    // Require admin authentication
    await requireAdmin();

    // Validate rejection reason
    const validationResult = rejectionReasonSchema.safeParse(rejectionReason);

    if (!validationResult.success) {
      return {
        error:
          validationResult.error.issues[0]?.message ||
          "Invalid rejection reason",
      };
    }

    const sanitizedReason = validationResult.data;

    // Get listing details before updating (to get owner info for notification)
    const listing = await listingDAL.getListingById(listingId);

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
      return {
        error: "Listing owner not found",
      };
    }

    // Update approval status
    const { error: updateError } = await tryCatch(
      listingDAL.updateApprovalStatus(listingId, "rejected", sanitizedReason),
    );

    if (updateError) {
      return {
        error: updateError.message || "Failed to reject listing",
      };
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
    const garageUrl = `${baseUrl}/dashboard/garage`;

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

    // Graceful degradation: notification sent even if revalidation fails
    try {
      revalidatePath("/admin/dashboard/listings/review");
      revalidatePath("/dashboard/garage");
    } catch (revalidateError) {
      console.error("Revalidation failed:", revalidateError);
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred while rejecting the listing";
    console.error("Error in rejectListingAction:", error);
    return {
      error: errorMessage,
    };
  }
}
