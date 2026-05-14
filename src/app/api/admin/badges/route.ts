import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { listingDAL, disputeDAL, serviceListingDAL } from "@/dal";

export interface AdminBadges {
  pendingListingReviews: number;
  pendingServiceReviews: number;
  pendingDisputes: number;
}

/**
 * GET /api/admin/badges
 *
 * Single-round-trip consolidation of the three sidebar count endpoints
 * (pending listing reviews, pending service reviews, pending disputes).
 * Pays the admin auth tax once instead of three times.
 */
async function getHandler() {
  try {
    const adminError = await requireAdminResponse();
    if (adminError) return adminError;

    const [pendingListingReviews, pendingServiceReviews, pendingDisputes] =
      await Promise.all([
        listingDAL.countPendingReviews(),
        serviceListingDAL.countPendingApprovals(),
        disputeDAL.countPendingDisputes(),
      ]);

    return NextResponse.json({
      pendingListingReviews,
      pendingServiceReviews,
      pendingDisputes,
    } satisfies AdminBadges);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(getHandler, "GET /api/admin/badges");
