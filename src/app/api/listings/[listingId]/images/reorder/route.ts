import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { eq } from "drizzle-orm";

import { db } from "@/db/db";
import { listingImages } from "@/db/schemas/listings.schema";

async function putHandler(request: NextRequest) {
  try {
    const { imageIds } = await request.json(); // Array of image IDs in new order

    // Update order indexes
    await Promise.all(
      imageIds.map((imageId: string, index: number) =>
        db
          .update(listingImages)
          .set({ orderIndex: index })
          .where(eq(listingImages.id, imageId)),
      ),
    );

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
