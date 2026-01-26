import { NextResponse } from "next/server";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { disputeDAL } from "@/dal";

/**
 * GET /api/admin/disputes/stats
 * Get comprehensive dispute statistics for admin dashboard
 * Requires admin authentication
 */
export async function GET() {
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
