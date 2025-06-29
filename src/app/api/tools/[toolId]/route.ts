import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { eq, max } from "drizzle-orm";

import { db } from "@/db/db";
import { toolImages } from "@/db/schemas/tools.schema";

export async function POST(
  request: NextRequest,
  { params }: { params: { toolId: string } },
) {
  try {
    const toolId = params.toolId;

    // Validate toolId exists and is a valid UUID
    if (!toolId || toolId === "") {
      return NextResponse.json(
        { error: "Tool ID is required" },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 },
      );
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 5MB)" },
        { status: 400 },
      );
    }

    // Get next order index
    const [maxOrder] = await db
      .select({ max: max(toolImages.orderIndex) })
      .from(toolImages)
      .where(eq(toolImages.toolId, toolId));

    const nextOrder = (maxOrder?.max || -1) + 1;

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `tools/${toolId}/${timestamp}-${sanitizedName}`;

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: "public",
    });

    // Save to database
    const [savedImage] = await db
      .insert(toolImages)
      .values({
        toolId,
        imageUrl: blob.url,
        blobPathname: blob.pathname,
        orderIndex: nextOrder,
      })
      .returning();

    return NextResponse.json({
      success: true,
      image: savedImage,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
