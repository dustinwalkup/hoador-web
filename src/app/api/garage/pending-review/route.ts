import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { listingDAL } from "@/dal";
import { db } from "@/db/db";
import { listings } from "@/db/schemas/listings.schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Get listings with pending_review status
    const pendingListings =
      await listingDAL.getUserListingsByApprovalStatus("pending_review");

    // Get listings with rejected status
    const rejectedListings =
      await listingDAL.getUserListingsByApprovalStatus("rejected");

    // Get rejection reasons for rejected listings
    const rejectedListingIds = rejectedListings.map((l) => l.id);
    const rejectionReasonsMap = new Map<string, string | null>();
    if (rejectedListingIds.length > 0) {
      const rejectionData = await db
        .select({
          id: listings.id,
          rejectionReason: listings.rejectionReason,
        })
        .from(listings)
        .where(eq(listings.ownerId, userId));

      rejectionData.forEach((item) => {
        if (rejectedListingIds.includes(item.id)) {
          rejectionReasonsMap.set(item.id, item.rejectionReason);
        }
      });
    }

    // Combine and add approval status fields
    const allListings = [
      ...pendingListings.map((listing) => ({
        ...listing,
        approvalStatus: "pending_review" as const,
        rejectionReason: undefined as string | undefined,
      })),
      ...rejectedListings.map((listing) => ({
        ...listing,
        approvalStatus: "rejected" as const,
        rejectionReason: rejectionReasonsMap.get(listing.id) || undefined,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return Response.json(allListings);
  } catch (error) {
    console.error("Pending review listings API error:", error);
    return Response.json(
      { error: "Failed to fetch pending review listings" },
      { status: 500 },
    );
  }
}
