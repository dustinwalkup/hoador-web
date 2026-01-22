import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/features/auth/utils/guards";
import { listingDAL } from "@/dal";

/**
 * GET /api/admin/listings/review/pending
 * Fetch paginated pending review listings
 * Requires admin authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    await requireAdmin();

    // Parse pagination parameters from query string
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Call DAL method with pagination
    const pagination = { page, limit };
    const result = await listingDAL.getPendingReviews(pagination);

    // Return JSON response with paginated results
    return NextResponse.json(result);
  } catch (error) {
    console.error("Pending reviews API error:", error);

    // Handle authentication errors
    if (error instanceof Error && error.message.includes("Admin privileges")) {
      return NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 },
      );
    }

    // Handle validation errors
    if (
      error instanceof Error &&
      (error.message.includes("Page") || error.message.includes("Limit"))
    ) {
      return NextResponse.json(
        { error: error.message || "Invalid pagination parameters" },
        { status: 400 },
      );
    }

    // Handle other errors
    return NextResponse.json(
      { error: "Failed to fetch pending reviews" },
      { status: 500 },
    );
  }
}
