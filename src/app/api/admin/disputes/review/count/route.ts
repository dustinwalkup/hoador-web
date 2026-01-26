import { NextResponse } from "next/server";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { disputeDAL } from "@/dal";

/**
 * GET /api/admin/disputes/review/count
 * Get count of pending disputes needing review
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

    // Call DAL method to get pending disputes count
    const count = await disputeDAL.countPendingDisputes();

    // Return JSON with count number
    return NextResponse.json({ count });
  } catch (error) {
    return handleApiError(error);
  }
}
