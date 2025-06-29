import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/db";
import { toolImages } from "@/db/schemas/tools.schema";

export async function PUT(request: NextRequest) {
  try {
    const { imageIds } = await request.json(); // Array of image IDs in new order

    // Update order indexes
    await Promise.all(
      imageIds.map((imageId: string, index: number) =>
        db
          .update(toolImages)
          .set({ orderIndex: index })
          .where(eq(toolImages.id, imageId)),
      ),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reorder error:", error);
    return NextResponse.json({ error: "Reorder failed" }, { status: 500 });
  }
}
