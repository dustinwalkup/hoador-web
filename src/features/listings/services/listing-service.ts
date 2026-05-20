import { eq, max, count } from "drizzle-orm";

import { db } from "@/db/db";
import { listingImages } from "@/db/schemas/listings.schema";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { NotFoundError, ForbiddenError, ValidationError } from "@/dal/errors";
import { communityDAL, legalDocumentDAL, listingDAL, userDAL } from "@/dal";
import { uploadToBlob } from "@/services/vercel-blob";
import {
  processImageForUpload,
  validateImageForProcessing,
  validateImageMagicBytes,
  getImageMetadata,
} from "@/lib/image/server";
import { trackActivity } from "@/features/activity/lib/track-activity";
import { sendRentalListingPendingAdminNotification } from "@/features/listings/notifications/listing-pending-review";
import type { CreateListingFormDataServerType } from "@/features/listings/form-schema/listing.schema";
import { getPayoutReadiness } from "@/features/payments/lib/payout-readiness";
import { logGatingEvent } from "@/features/payments/lib/log-events";

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

/** Request metadata for legal acceptance audit when creating a listing. */
export interface ListingCreationContext {
  ipAddress: string | null;
  userAgent: string | null;
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
   * Creates a rental listing after community membership check, records activity,
   * notifies admins, and records legal document acceptances. Stripe Connect is
   * NOT required at this stage; it is enforced just-in-time at booking acceptance.
   *
   * @param validatedData - Server-validated listing form payload
   * @param userId - Authenticated owner user id
   * @param context - IP and user agent for legal acceptance records
   * @returns The new listing id
   * @throws ValidationError if community membership is missing
   */
  static async createListing(
    validatedData: CreateListingFormDataServerType,
    userId: string,
    context: ListingCreationContext,
  ): Promise<{ listingId: string }> {
    const userCommunityInfo =
      await communityDAL.requireUserCommunityMembership(userId);

    const listing = await listingDAL.createListing(
      validatedData,
      userId,
      userCommunityInfo.community.id,
    );

    if (!listing) {
      throw new Error("Failed to create listing");
    }

    const user = await userDAL.getUserById(userId);
    const readiness = getPayoutReadiness({
      stripeConnectedAccountId: user.stripeConnectedAccountId ?? null,
      connectChargesEnabled: user.connectChargesEnabled,
      connectPayoutsEnabled: user.connectPayoutsEnabled,
      connectOnboardingComplete: user.connectOnboardingComplete,
    });
    if (readiness.onboardingStatus !== "verified") {
      logGatingEvent("listing_created_without_stripe_connect", {
        userId,
        listingId: listing.id,
        onboardingStatus: readiness.onboardingStatus,
      });
    }

    trackActivity(userId, "listing_created", { listingId: listing.id });

    sendRentalListingPendingAdminNotification({
      id: listing.id,
      name: listing.name,
      ownerId: userId,
    }).catch((err) => {
      console.error("Failed to send listing pending admin notification:", err);
    });

    try {
      const { ipAddress, userAgent } = context;
      const documentVersions = await legalDocumentDAL.getAllCurrentVersions();
      const acceptancePromises: Promise<unknown>[] = [];

      if (documentVersions[LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE]) {
        const doc =
          documentVersions[LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE];
        acceptancePromises.push(
          legalDocumentDAL.recordAcceptance(
            userId,
            LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE,
            doc.version,
            ipAddress,
            userAgent,
            "listing_creation",
            undefined,
            listing.id,
          ),
        );
      }

      if (
        documentVersions[
          LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT
        ]
      ) {
        const doc =
          documentVersions[
            LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT
          ];
        acceptancePromises.push(
          legalDocumentDAL.recordAcceptance(
            userId,
            LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT,
            doc.version,
            ipAddress,
            userAgent,
            "listing_creation",
            undefined,
            listing.id,
          ),
        );
      }

      await Promise.all(acceptancePromises);
    } catch (error) {
      console.error("Error recording legal document acceptances:", error);
    }

    return { listingId: listing.id };
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
  static async deleteListing(listingId: string, userId: string): Promise<void> {
    await this.verifyOwnership(listingId, userId);

    await listingDAL.deleteListing(listingId);

    trackActivity(userId, "listing_deleted", { listingId });
  }
}
