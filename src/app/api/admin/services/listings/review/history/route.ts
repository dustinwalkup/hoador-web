import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { serviceListingDAL } from "@/dal";

/**
 * GET /api/admin/services/listings/review/history
 * Fetch paginated service listing review history (approved/rejected/inactive).
 * Requires admin authentication.
 */
async function getHandler(request: NextRequest) {
  try {
    const adminError = await requireAdminResponse();
    if (adminError) return adminError;

    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get("status") || "all";

    const status: "approved" | "rejected" | "all" = [
      "approved",
      "rejected",
      "all",
    ].includes(statusParam)
      ? (statusParam as "approved" | "rejected" | "all")
      : "all";

    const rawPage = parseInt(searchParams.get("page") || "1", 10);
    const rawLimit = parseInt(searchParams.get("limit") || "10", 10);

    const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limit =
      Number.isNaN(rawLimit) || rawLimit < 1 || rawLimit > 100 ? 10 : rawLimit;

    const pagination = { page, limit };
    const result = await serviceListingDAL.findReviewHistory(
      status,
      pagination,
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/admin/services/listings/review/history",
);
