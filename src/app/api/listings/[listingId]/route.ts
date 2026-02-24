import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import { uploadToBlob } from "@/services/vercel-blob";
import { eq, max } from "drizzle-orm";

import { db } from "@/db/db";
import { listingImages } from "@/db/schemas/listings.schema";
import {
  processImageForUpload,
  validateImageForProcessing,
  getImageMetadata,
} from "@/lib/image/server";
import {
  handleApiError,
  parseFormData,
  getAuthenticatedUserResponse,
} from "@/lib/api/route-helpers";
import {
  createListingSchemaServer,
  type CreateListingFormDataServerType,
} from "@/features/listings/form-schema/listing.schema";
import { listingDAL } from "@/dal";
import { trackActivity } from "@/features/activity/lib/track-activity";

/**
 * POST /api/listings/[listingId]
 * Upload a listing image
 */
async function postHandler(
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
export const POST = withRequestLogging(
  postHandler,
  "POST /api/listings/[listingId]",
);

/**
 * PATCH /api/listings/[listingId]
 * Update a listing
 */
async function patchHandler(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    // Check authentication
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId: currentUserId } = authResult;

    const { listingId } = await params;

    // Validate listingId
    if (!listingId || listingId === "") {
      return NextResponse.json(
        { error: "Listing ID is required" },
        { status: 400 },
      );
    }

    // Parse request body
    const body = await parseFormData(request);

    // Validate form data
    const validationResult = createListingSchemaServer.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const validatedData =
      validationResult.data as CreateListingFormDataServerType;

    // Verify ownership before updating
    const existingListing = await listingDAL.getListingById(listingId);
    if (!existingListing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (existingListing.owner.id !== currentUserId) {
      return NextResponse.json(
        { error: "Forbidden: You can only update your own listings" },
        { status: 403 },
      );
    }

    // Update the listing
    const { data: listing, error } = await tryCatch(
      listingDAL.updateListing(listingId, validatedData, currentUserId),
    );

    if (error) {
      return handleApiError(error);
    }

    if (!listing) {
      return NextResponse.json(
        { error: "Failed to update listing" },
        { status: 500 },
      );
    }

    trackActivity(currentUserId, "listing_updated", { listingId: listing.id });

    return NextResponse.json({
      success: true,
      listingId: listing.id,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const PATCH = withRequestLogging(
  patchHandler,
  "PATCH /api/listings/[listingId]",
);

/**
 * DELETE /api/listings/[listingId]
 * Delete a listing
 */
async function deleteHandler(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    const { listingId } = await params;

    // Validate listingId exists and is a valid UUID
    if (!listingId || listingId === "") {
      return NextResponse.json(
        { error: "Listing ID is required" },
        { status: 400 },
      );
    }

    // Check authentication
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    // Verify ownership before deleting
    const existingListing = await listingDAL.getListingById(listingId);
    if (!existingListing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (existingListing.owner.id !== userId) {
      return NextResponse.json(
        { error: "Forbidden: You can only delete your own listings" },
        { status: 403 },
      );
    }

    // Delete the listing
    const result = await tryCatch(listingDAL.deleteListing(listingId));

    if (result.error) {
      console.error("Error deleting listing:", result.error);
      if (result.error instanceof Error) {
        // Check if it's an authorization error
        if (
          result.error.message.includes("not found") ||
          result.error.message.includes("access denied") ||
          result.error.message.includes("Unauthorized")
        ) {
          return NextResponse.json(
            { error: result.error.message },
            { status: 403 },
          );
        }
        return NextResponse.json(
          { error: result.error.message },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { error: "An unexpected error occurred while deleting the listing" },
        { status: 500 },
      );
    }

    trackActivity(userId, "listing_deleted", { listingId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete listing API error:", error);
    return NextResponse.json(
      { error: "Failed to delete listing" },
      { status: 500 },
    );
  }
}
export const DELETE = withRequestLogging(
  deleteHandler,
  "DELETE /api/listings/[listingId]",
);
