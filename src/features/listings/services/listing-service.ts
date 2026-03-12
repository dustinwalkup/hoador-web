import { eq, max, count } from "drizzle-orm";

import { db } from "@/db/db";
import { listingImages } from "@/db/schemas/listings.schema";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "@/dal/errors";
import { listingDAL } from "@/dal";
import { uploadToBlob } from "@/services/vercel-blob";
import {
  processImageForUpload,
  validateImageForProcessing,
  validateImageMagicBytes,
  getImageMetadata,
} from "@/lib/image/server";
import { trackActivity } from "@/features/activity/lib/track-activity";
import type { CreateListingFormDataServerType } from "@/features/listings/form-schema/listing.schema";

const MAX_IMAGES_PER_LISTING = 10;

export interface UploadListingImageInput {
  listingId: string;
  file: File;
}

export interface UploadListingImageResult {
  image: typeof listingImages.$inferSelect;
}

export interface UpdateListingResult {
  listingId: string;
}

export class ListingService {
  /**
   * Verify listing exists and is owned by the given user.
   * @throws NotFoundError if listing not found
   * @throws ForbiddenError if user does not own the listing
   */
  private static async verifyOwnership(listingId: string, userId: string) {
    const listing = await listingDAL.getListingById(listingId);
    if (!listing) {
      throw new NotFoundError("Listing", listingId);
    }
    if (listing.owner.id !== userId) {
      throw new ForbiddenError(
        "You do not have permission to modify this listing",
      );
    }
    return listing;
  }

  /**
   * Upload an image to a listing.
   *
   * @throws NotFoundError if listing not found
   * @throws ForbiddenError if user doesn't own the listing
   * @throws ValidationError if file is invalid or max images reached
   */
  static async uploadListingImage(
    input: UploadListingImageInput,
    userId: string,
  ): Promise<UploadListingImageResult> {
    const { listingId, file } = input;

    await this.verifyOwnership(listingId, userId);

    // Enforce max images per listing
    const [countResult] = await db
      .select({ count: count() })
      .from(listingImages)
      .where(eq(listingImages.listingId, listingId));

    if (countResult.count >= MAX_IMAGES_PER_LISTING) {
      throw new ValidationError(
        `Maximum ${MAX_IMAGES_PER_LISTING} images per listing`,
      );
    }

    // Validate file type and size
    const validationError = validateImageForProcessing(file, 10);
    if (validationError) {
      throw new ValidationError(validationError);
    }

    // Convert file to buffer and validate magic bytes
    const buffer = Buffer.from(await file.arrayBuffer());

    if (!validateImageMagicBytes(buffer)) {
      throw new ValidationError("Invalid image file content");
    }

    // Log original metadata
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

    // Process image (JPEG, 85% quality, max 2048px)
    const processedBuffer = await processImageForUpload(buffer, {
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 85,
      format: "jpeg",
    });

    // Log processed metadata
    const processedMetadata = await getImageMetadata(processedBuffer);
    console.log(`Processed listing image: ${file.name}`, {
      processedSize: `${(processedMetadata.size / (1024 * 1024)).toFixed(2)}MB`,
      processedDimensions: `${processedMetadata.width}x${processedMetadata.height}`,
      compressionRatio: `${((1 - processedMetadata.size / originalMetadata.size) * 100).toFixed(1)}%`,
    });

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `listings/${listingId}/${timestamp}-${sanitizedName.replace(/\.[^/.]+$/, ".jpg")}`;

    // Upload to blob storage
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

    return { image: savedImage };
  }

  /**
   * Update a listing's details.
   *
   * @throws NotFoundError if listing not found
   * @throws ForbiddenError if user doesn't own the listing
   */
  static async updateListing(
    listingId: string,
    data: CreateListingFormDataServerType,
    userId: string,
  ): Promise<UpdateListingResult> {
    await this.verifyOwnership(listingId, userId);

    const listing = await listingDAL.updateListing(listingId, data, userId);

    trackActivity(userId, "listing_updated", { listingId: listing.id });

    return { listingId: listing.id };
  }

  /**
   * Delete a listing.
   *
   * @throws NotFoundError if listing not found
   * @throws ForbiddenError if user doesn't own the listing
   */
  static async deleteListing(
    listingId: string,
    userId: string,
  ): Promise<void> {
    await this.verifyOwnership(listingId, userId);

    await listingDAL.deleteListing(listingId);

    trackActivity(userId, "listing_deleted", { listingId });
  }
}
