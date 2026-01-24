import { NextResponse } from "next/server";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { listingDAL } from "@/dal";

/**
 * GET /api/admin/listings/review/count
 * Get count of pending reviews
 * Requires admin authentication
 * Optimized for fast response (used in sidebar badge)
 */
export async function GET() {
  try {
    // Require admin authentication
    const adminError = await requireAdminResponse();
    if (adminError) {
      return adminError;
    }

    // Call DAL method to get pending review count
    const count = await listingDAL.countPendingReviews();

    // Return JSON with count number
    return NextResponse.json({ count });
  } catch (error) {
    return handleApiError(error);
  }
}
