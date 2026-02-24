import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  requireAdminResponse,
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { listingDAL } from "@/dal";

/**
 * GET /api/admin/listings/review/pending
 * Fetch paginated pending review listings
 * Requires admin authentication
 */
async function getHandler(request: NextRequest) {
  try {
    // Require admin authentication
    const adminCheck = await requireAdminResponse();
    if (adminCheck) {
      return adminCheck; // Returns 401 or 403
    }

    // Get authenticated user (we know they're admin at this point)
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId: adminUserId } = authResult;

    // Parse pagination parameters from query string
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    // Call DAL method with pagination
    const pagination = { page, limit };
    const result = await listingDAL.getPendingReviews(pagination, adminUserId);

    // Return JSON response with paginated results
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(
  getHandler,
  "GET /api/admin/listings/review/pending",
);
