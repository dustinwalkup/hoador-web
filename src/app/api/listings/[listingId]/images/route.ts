import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/db";
import { listingImages } from "@/db/schemas/listings.schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    const { listingId } = await params;

    // Validate listingId exists and is a valid UUID
    if (!listingId || listingId === "") {
      return NextResponse.json(
        { error: "listing ID is required" },
        { status: 400 },
      );
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
