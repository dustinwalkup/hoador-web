import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { serviceListingDAL } from "@/dal";

/**
 * GET /api/admin/services/listings/review/count
 * Get count of service listings pending admin approval.
 * Requires admin authentication.
 * Optimized for fast response (used in sidebar badge).
 */
async function getHandler() {
  try {
    const adminError = await requireAdminResponse();
    if (adminError) return adminError;

    const count = await serviceListingDAL.countPendingApprovals();
    return NextResponse.json({ count });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/admin/services/listings/review/count",
);
