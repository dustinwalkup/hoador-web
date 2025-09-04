import { NextRequest, NextResponse } from "next/server";
import { deleteFromBlob } from "@/services/vercel-blob";
import { eq, and } from "drizzle-orm";

import { db } from "@/db/db";
import { listingImages } from "@/db/schemas/listings.schema";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string; imageId: string }> },
) {
  try {
    const { listingId, imageId } = await params;

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
