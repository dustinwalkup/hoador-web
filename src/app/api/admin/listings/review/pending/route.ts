import { NextRequest, NextResponse } from "next/server";
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
export async function GET(request: NextRequest) {
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
    const limit = parseInt(searchParams.get("limit") || "20");

    // Call DAL method with pagination
    const pagination = { page, limit };
    const result = await listingDAL.getPendingReviews(pagination, adminUserId);

    // Return JSON response with paginated results
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
