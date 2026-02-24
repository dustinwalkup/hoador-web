import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { listingDAL } from "@/dal";

/**
 * GET /api/admin/listings/review/history
 * Fetch paginated review history (approved/rejected listings)
 * Requires admin authentication
 */
async function getHandler(request: NextRequest) {
  try {
    // Require admin authentication
    const adminError = await requireAdminResponse();
    if (adminError) {
      return adminError;
    }

    // Parse status filter and pagination parameters from query string
    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get("status") || "all";
    const status = ["approved", "rejected", "all"].includes(statusParam)
      ? (statusParam as "approved" | "rejected" | "all")
      : "all";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    // Call DAL method with status filter and pagination
    const pagination = { page, limit };
    const result = await listingDAL.getReviewHistory(status, pagination);

    // Return JSON response with paginated results
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(
  getHandler,
  "GET /api/admin/listings/review/history",
);
