import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/db";
import { listingImages } from "@/db/schemas/listings.schema";
import { getAuthenticatedUserResponse } from "@/lib/api/route-helpers";
import { listingDAL } from "@/dal";
import { MAX_IMAGES_PER_LISTING } from "@/constants/listings";

/**
 * The body this route always assumed it was getting. Previously it destructured
 * `imageIds` straight off `request.json()` and called `.map` on it, so a
 * malformed body (a string, a number, a missing key, unparseable JSON) threw a
 * TypeError and surfaced as a 500 — an input error reported as a server fault.
 *
 * Duplicates are refused rather than tolerated: each id becomes one scoped
 * UPDATE, so a repeated id would leave a gap in `orderIndex` and silently drop
 * another image's position.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-10-manage-listings-ai.md
 *       § F16 / P-E10-5
 */
const reorderImagesSchema = z.object({
  imageIds: z
    .array(z.string().uuid("Each image id must be a UUID"))
    .min(1, "At least one image id is required")
    .max(
      MAX_IMAGES_PER_LISTING,
      `At most ${MAX_IMAGES_PER_LISTING} image ids may be reordered`,
    )
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Image ids must be unique",
    ),
});

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

    // Array of image IDs in new order.
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const parsed = reorderImagesSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }
    const { imageIds } = parsed.data;

    // Update order indexes. Each update is scoped to BOTH the image id and the
    // listing id: ownership is verified on the listing above, but without the
    // listing-id predicate a caller could reorder images belonging to a listing
    // they don't own by passing foreign image ids (F32).
    await Promise.all(
      imageIds.map((imageId, index) =>
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
