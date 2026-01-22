import { getCurrentUserId } from "@/features/auth/utils/session";
import { listingDAL } from "@/dal";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Get count of pending and rejected listings
    const [pendingListings, rejectedListings] = await Promise.all([
      listingDAL.getUserListingsByApprovalStatus("pending_review"),
      listingDAL.getUserListingsByApprovalStatus("rejected"),
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
