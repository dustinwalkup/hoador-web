import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { userDAL, listingDAL, communityDAL } from "@/dal";

/**
 * GET /api/admin/metrics
 * Admin dashboard metrics: total users, active listings, membership counts per
 * community, users with no community, pending support tickets (always 0).
 * Requires admin authentication.
 */
async function getHandler() {
  try {
    const adminError = await requireAdminResponse();
    if (adminError) {
      return adminError;
    }

    const [
      totalUsers,
      activeListings,
      membershipByCommunity,
      usersWithoutCommunity,
    ] = await Promise.all([
      userDAL.getTotalUserCount(),
      listingDAL.getActiveListingsCount(),
      communityDAL.getMembershipCountsByCommunity(),
      userDAL.countUsersWithNoCommunityMembership(),
    ]);

    return NextResponse.json({
      totalUsers,
      activeListings,
      pendingSupportTickets: 0,
      membershipByCommunity,
      usersWithoutCommunity,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(getHandler, "GET /api/admin/metrics");
