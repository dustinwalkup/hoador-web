import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { eq } from "drizzle-orm";

import { db } from "@/db/db";
import { listingImages } from "@/db/schemas/listings.schema";
import { getAuthenticatedUserResponse } from "@/lib/api/route-helpers";
import { listingDAL } from "@/dal";

/**
 * GET /api/listings/[listingId]/images
 *
 * **Owner-only.** This route previously had NO session check at all — it went
 * straight from `params` to a `db.select()`, so anyone holding a listing id got
 * that listing's image rows, including for `pending_review` and `rejected`
 * listings whose images are by definition un-moderated and not public, plus
 * `blobPathname`, an internal storage path (mobile F15 / P-E10-7).
 *
 * Owner-only rather than mirroring the listing detail's broader visibility
 * rules, because the only caller is the owner's own edit form
 * (`useListingImages` ← `add-listing-form.tsx`). Everyone else already gets the
 * images they are allowed to see on `GET /api/listings/[listingId]` itself, so
 * narrowing this costs no caller anything.
 *
 * **403 for a non-owner, matching its two siblings** under `images/` (the
 * `[imageId]` DELETE and `reorder` PUT), rather than the listing detail route's
 * deliberate 404-instead-of-403. That route hides existence because it is the
 * public read path; these three are owner tools reached from the garage, where
 * the caller already knows the listing exists. Consistency inside one directory
 * is worth more here than a distinction that only matters on a public surface.
 */
async function getHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const { listingId } = await params;

    // Validate listingId exists and is a valid UUID
    if (!listingId || listingId === "") {
      return NextResponse.json(
        { error: "listing ID is required" },
        { status: 400 },
      );
    }

    const listing = await listingDAL.getListingById(listingId);
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.owner.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all images for this listing, ordered by orderIndex
    const images = await db
      .select()
      .from(listingImages)
      .where(eq(listingImages.listingId, listingId))
      .orderBy(listingImages.orderIndex);

    return NextResponse.json({
      success: true,
      images,
    });
  } catch (error) {
    console.error("Get images error:", error);
    return NextResponse.json(
      { error: "Failed to get images" },
      { status: 500 },
    );
  }
}
export const GET = withRequestLogging(
  getHandler,
  "GET /api/listings/[listingId]/images",
);
