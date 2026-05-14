import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { communityDAL } from "@/dal";
import {
  requireAdminResponse,
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";

/**
 * GET /api/admin/community-memberships/pending?page&limit&communityId
 * Paginated queue of memberships awaiting residency verification.
 * Each row includes the user and their submitted primary address.
 * Requires admin authentication.
 */
async function getHandler(request: NextRequest) {
  try {
    const adminCheck = await requireAdminResponse();
    if (adminCheck) return adminCheck;

    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const communityId = searchParams.get("communityId") || undefined;

    const result = await communityDAL.listPendingVerifications({
      page,
      limit,
      communityId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(
  getHandler,
  "GET /api/admin/community-memberships/pending",
);
