import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { getAuthenticatedUserResponse } from "@/lib/api/route-helpers";
import { listingDAL } from "@/dal";

async function getHandler() {
  try {
    // Check authentication
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    // Get count of pending and rejected listings
    const [pendingListings, rejectedListings] = await Promise.all([
      listingDAL.getUserListingsByApprovalStatus("pending_review", userId),
      listingDAL.getUserListingsByApprovalStatus("rejected", userId),
    ]);

    const count = pendingListings.length + rejectedListings.length;

    return Response.json({ count });
  } catch (error) {
    console.error("Pending listings count API error:", error);
    return Response.json(
      { error: "Failed to fetch pending listings count" },
      { status: 500 },
    );
  }
}
export const GET = withRequestLogging(
  getHandler,
  "GET /api/garage/pending-count",
);
