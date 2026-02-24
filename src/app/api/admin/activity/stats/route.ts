import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { userActivityDAL } from "@/dal";

/**
 * GET /api/admin/activity/stats
 * Returns active user counts by time bucket and inactive user counts.
 * Requires admin authentication.
 */
async function getHandler() {
  try {
    const adminError = await requireAdminResponse();
    if (adminError) {
      return adminError;
    }

    const stats = await userActivityDAL.getActivityStats();
    return NextResponse.json(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(
  getHandler,
  "GET /api/admin/activity/stats",
);
