import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { disputeDAL } from "@/dal";

/**
 * GET /api/admin/disputes/stats
 * Get comprehensive dispute statistics for admin dashboard
 * Requires admin authentication
 */
async function getHandler() {
  try {
    // Require admin authentication
    const adminError = await requireAdminResponse();
    if (adminError) {
      return adminError;
    }

    // Call DAL method to get dispute statistics
    const stats = await disputeDAL.getDisputeStats();

    // Return JSON with statistics
    return NextResponse.json(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(
  getHandler,
  "GET /api/admin/disputes/stats",
);
