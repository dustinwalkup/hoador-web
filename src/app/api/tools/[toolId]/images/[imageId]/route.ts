import { NextRequest, NextResponse } from "next/server";
import { deleteFromBlob } from "@/services/vercel-blob";
import { eq, and } from "drizzle-orm";

import { db } from "@/db/db";
import { toolImages } from "@/db/schemas/tools.schema";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string; imageId: string }> },
) {
  try {
    const { toolId, imageId } = await params;

    // Get image from database
    const [image] = await db
      .select()
      .from(toolImages)
      .where(and(eq(toolImages.id, imageId), eq(toolImages.toolId, toolId)));

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Delete from Vercel Blob
    await deleteFromBlob(image.blobPathname);

    // Delete from database
    await db.delete(toolImages).where(eq(toolImages.id, imageId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
