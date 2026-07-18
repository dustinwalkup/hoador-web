import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { eq, and } from "drizzle-orm";

import { db } from "@/db/db";
import { listingImages } from "@/db/schemas/listings.schema";
import { getAuthenticatedUserResponse } from "@/lib/api/route-helpers";
import { listingDAL } from "@/dal";

async function putHandler(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const { listingId } = await params;

    const listing = await listingDAL.getListingById(listingId);
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.owner.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { imageIds } = await request.json(); // Array of image IDs in new order

    // Update order indexes. Each update is scoped to BOTH the image id and the
    // listing id: ownership is verified on the listing above, but without the
    // listing-id predicate a caller could reorder images belonging to a listing
    // they don't own by passing foreign image ids (F32).
    await Promise.all(
      imageIds.map((imageId: string, index: number) =>
        db
          .update(listingImages)
          .set({ orderIndex: index })
          .where(
            and(
              eq(listingImages.id, imageId),
              eq(listingImages.listingId, listingId),
            ),
          ),
      ),
    );

    // Reordering does NOT re-trigger review (Req 2.7.1, amended): rearranging
    // already-approved images introduces no un-moderated content. Only ADDING
    // an image can, and that trigger lives in the upload path.

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reorder error:", error);
    return NextResponse.json({ error: "Reorder failed" }, { status: 500 });
  }
}
export const PUT = withRequestLogging(
  putHandler,
  "PUT /api/listings/[listingId]/images/reorder",
);
