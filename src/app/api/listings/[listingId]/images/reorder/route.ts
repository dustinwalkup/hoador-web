import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/db";
import { listingImages } from "@/db/schemas/listings.schema";

export async function PUT(request: NextRequest) {
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
