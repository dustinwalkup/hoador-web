import { NextResponse } from "next/server";
import { requireAdmin } from "@/features/auth/utils/guards";
import { listingDAL } from "@/dal";

/**
 * GET /api/admin/listings/review/count
 * Get count of pending reviews
 * Requires admin authentication
 * Optimized for fast response (used in sidebar badge)
 */
export async function GET() {
  try {
    // Require admin authentication
    await requireAdmin();

    // Call DAL method to get pending review count
    const count = await listingDAL.countPendingReviews();

    // Return JSON with count number
    return NextResponse.json({ count });
  } catch (error) {
    console.error("Pending review count API error:", error);

    // Handle authentication errors
    if (error instanceof Error && error.message.includes("Admin privileges")) {
      return NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 },
      );
    }

    // Handle other errors
    return NextResponse.json(
      { error: "Failed to fetch pending review count" },
      { status: 500 },
    );
  }
}
