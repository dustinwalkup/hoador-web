import { NextResponse } from "next/server";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { userDAL, listingDAL } from "@/dal";

/**
 * GET /api/admin/metrics
 * Get platform metrics for admin dashboard (total users, active listings).
 * Support tickets are not implemented; always returns 0.
 * Requires admin authentication.
 */
export async function GET() {
  try {
    const adminError = await requireAdminResponse();
    if (adminError) {
      return adminError;
    }

    const [totalUsers, activeListings] = await Promise.all([
      userDAL.getTotalUserCount(),
      listingDAL.getActiveListingsCount(),
    ]);

    return NextResponse.json({
      totalUsers,
      activeListings,
      pendingSupportTickets: 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
