import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { deleteFromBlob } from "@/services/vercel-blob";
import { eq, and } from "drizzle-orm";

import { db } from "@/db/db";
import { listingImages } from "@/db/schemas/listings.schema";
import { getAuthenticatedUserResponse } from "@/lib/api/route-helpers";
import { listingDAL } from "@/dal";

async function deleteHandler(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string; imageId: string }> },
) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const { listingId, imageId } = await params;

    const listing = await listingDAL.getListingById(listingId);
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.owner.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get image from database
    const [image] = await db
      .select()
      .from(listingImages)
      .where(
        and(
          eq(listingImages.id, imageId),
          eq(listingImages.listingId, listingId),
        ),
      );

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Delete from Vercel Blob
    await deleteFromBlob(image.blobPathname);

    // Delete from database
    await db.delete(listingImages).where(eq(listingImages.id, imageId));

    // Removing an image does NOT re-trigger review (Req 2.7.1, amended): the
    // remaining images were already approved, and dropping one introduces no
    // un-moderated content. Only ADDING an image re-triggers review.

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
export const DELETE = withRequestLogging(
  deleteHandler,
  "DELETE /api/listings/[listingId]/images/[imageId]",
);
