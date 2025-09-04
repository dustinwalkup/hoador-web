import { NextRequest, NextResponse } from "next/server";
import { uploadToBlob } from "@/services/vercel-blob";
import { eq, max } from "drizzle-orm";

import { db } from "@/db/db";
import { listingImages } from "@/db/schemas/listings.schema";
import {
  processImageForUpload,
  validateImageForProcessing,
  getImageMetadata,
} from "@/lib/image/server";

export async function POST(
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

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file
    const validationError = validateImageForProcessing(file, 10); // 10MB max
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Get original metadata for logging
    const originalMetadata = await getImageMetadata(buffer);
    console.log(`Processing listing image: ${file.name}`, {
      originalSize: `${(originalMetadata.size / (1024 * 1024)).toFixed(2)}MB`,
      originalDimensions: `${originalMetadata.width}x${originalMetadata.height}`,
      originalFormat: originalMetadata.format,
    });

    // Get next order index
    const [maxOrder] = await db
      .select({ max: max(listingImages.orderIndex) })
      .from(listingImages)
      .where(eq(listingImages.listingId, listingId));

    const nextOrder = (maxOrder?.max || -1) + 1;

    // Process image (Airbnb-style: JPEG, 85% quality, max 2048px)
    const processedBuffer = await processImageForUpload(buffer, {
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 85,
      format: "jpeg",
    });

    // Get processed metadata
    const processedMetadata = await getImageMetadata(processedBuffer);
    console.log(`Processed listing image: ${file.name}`, {
      processedSize: `${(processedMetadata.size / (1024 * 1024)).toFixed(2)}MB`,
      processedDimensions: `${processedMetadata.width}x${processedMetadata.height}`,
      compressionRatio: `${((1 - processedMetadata.size / originalMetadata.size) * 100).toFixed(1)}%`,
    });

    // Generate unique filename with .jpg extension
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `listings/${listingId}/${timestamp}-${sanitizedName.replace(/\.[^/.]+$/, ".jpg")}`;

    // Upload processed image to Vercel Blob
    const blob = await uploadToBlob(filename, processedBuffer);

    // Save to database
    const [savedImage] = await db
      .insert(listingImages)
      .values({
        listingId,
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
