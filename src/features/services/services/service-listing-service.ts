import { after } from "next/server";
import {
  auditLogDAL,
  reviewEventsDAL,
  serviceBookingDAL,
  serviceListingDAL,
  userDAL,
} from "@/dal";
import type { ServiceListing } from "@/db/schemas/services.schema";
import { ForbiddenError, NotFoundError, ValidationError } from "@/dal/errors";
import {
  sendListingApprovedNotification,
  sendListingPendingAdminNotification,
  sendListingRejectedNotification,
} from "@/features/services/notifications/service-notifications";
import { getPayoutReadiness } from "@/features/payments/lib/payout-readiness";
import { logGatingEvent } from "@/features/payments/lib/log-events";
import {
  linkListingToNeed,
  notifyRequesterListingLive,
} from "@/features/neighborhood-needs/services/neighborhood-needs-service";
import { captureNonCriticalError } from "@/lib/api/route-helpers";

import { uploadToBlob } from "@/services/vercel-blob";
import {
  processImageForUpload,
  validateImageForProcessing,
  validateImageMagicBytes,
} from "@/lib/image/server";
import { MAX_SERVICE_PHOTOS } from "@/constants/services";

import type { AuditContext, CreateListingInput } from "../types";

export type CreateListingResult = { success: true; listing: ServiceListing };

/**
 * Application service for HOA service listings (create, edit, admin approval).
 */
export class ServiceListingService {
  /**
   * Append a new review note onto an existing scalar field without deleting
   * previous content.
   *
   * This keeps a lightweight "latest display" history for legacy UI while the
   * full timeline is sourced from `review_events`.
   */
  static appendReviewScalar(
    existing: string | null | undefined,
    next: string,
    label: string,
  ): string {
    const trimmed = next.trim();
    if (!trimmed) return existing ?? "";

    const timestamp = new Date().toISOString();
    const nextChunk = `${label} (${timestamp}): ${trimmed}`;

    if (!existing || existing.trim().length === 0) return nextChunk;

    return `${existing}\n\n---\n${nextChunk}`;
  }

  /**
   * Submits a new listing for admin approval. Stripe Connect is NOT required at
   * this stage; it is enforced just-in-time at booking acceptance.
   */
  static async createListing(
    formData: CreateListingInput,
    providerId: string,
    context: AuditContext,
  ): Promise<CreateListingResult> {
    const listing = await serviceListingDAL.create({
      communityId: formData.communityId,
      providerId,
      categoryId: formData.categoryId,
      title: formData.title,
      description: formData.description,
      pricingType: formData.pricingType,
      price: String(formData.price),
      ownerPoliciesAcknowledged: formData.ownerPoliciesAcknowledged,
      serviceNotes: formData.serviceNotes ?? null,
      status: "pending_approval",
      adminNote: null,
      rejectionReason: null,
    });

    const user = await userDAL.getUserById(providerId);
    const readiness = getPayoutReadiness({
      stripeConnectedAccountId: user.stripeConnectedAccountId ?? null,
      connectChargesEnabled: user.connectChargesEnabled,
      connectPayoutsEnabled: user.connectPayoutsEnabled,
      connectOnboardingComplete: user.connectOnboardingComplete,
    });
    if (readiness.onboardingStatus !== "verified") {
      logGatingEvent("listing_created_without_stripe_connect", {
        userId: providerId,
        listingId: listing.id,
        onboardingStatus: readiness.onboardingStatus,
      });
    }

    await auditLogDAL.create({
      entityType: "service_listing",
      entityId: listing.id,
      action: "service_listing.created",
      userId: providerId,
      metadata: {
        communityId: formData.communityId,
        categoryId: formData.categoryId,
        status: listing.status,
      },
      ipAddress: context.ipAddress ?? undefined,
      userAgent: context.userAgent ?? undefined,
    });

    await sendListingPendingAdminNotification(listing);

    if (formData.neighborhoodNeedId) {
      const needId = formData.neighborhoodNeedId;
      const listingId = listing.id;
      after(async () => {
        await linkListingToNeed({
          neighborhoodNeedId: needId,
          listingType: "service",
          listingId,
          creatorUserId: providerId,
        }).catch((err) =>
          captureNonCriticalError(err, {
            route: "/api/services/listings",
            action: "linkListingToNeed",
          }),
        );
      });
    }

    return { success: true, listing };
  }

  /**
   * Provider updates an existing listing (no re-approval in Phase 1).
   */
  static async editListing(
    listingId: string,
    providerId: string,
    updates: Partial<
      Pick<
        ServiceListing,
        | "title"
        | "description"
        | "pricingType"
        | "price"
        | "ownerPoliciesAcknowledged"
        | "serviceNotes"
      >
    >,
    context: AuditContext,
  ): Promise<ServiceListing> {
    const existing = await serviceListingDAL.getById(listingId);
    if (!existing || existing.providerId !== providerId) {
      throw new ForbiddenError("You do not own this listing");
    }

    const patch: Partial<ServiceListing> = {};
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.description !== undefined)
      patch.description = updates.description;
    if (updates.pricingType !== undefined)
      patch.pricingType = updates.pricingType;
    if (updates.price !== undefined) {
      patch.price = String(updates.price) as ServiceListing["price"];
    }
    if (updates.ownerPoliciesAcknowledged !== undefined) {
      patch.ownerPoliciesAcknowledged = updates.ownerPoliciesAcknowledged;
    }
    if (updates.serviceNotes !== undefined)
      patch.serviceNotes = updates.serviceNotes;

    // If the listing was previously denied, provider edits act as a resubmission
    // back into the admin review queue — and clear the reason with it. A value
    // surviving into `pending_approval` is stale by definition, and every
    // surface that renders it keys off the row rather than the status, so a
    // leftover reason shows a provider a rejection banner on a listing that is
    // queued for review. The durable history stays in `review_events`, which is
    // what the admin card reads. Mirrors the rental fix (mobile P-E10-2, F7) —
    // the two moderation flows had the same gap.
    if (existing.status === "denied") {
      patch.status = "pending_approval";
      patch.rejectionReason = null;
    }

    const updated = await serviceListingDAL.update(listingId, patch);

    await auditLogDAL.create({
      entityType: "service_listing",
      entityId: listingId,
      action: "service_listing.updated",
      userId: providerId,
      metadata: { fields: Object.keys(patch) },
      ipAddress: context.ipAddress ?? undefined,
      userAgent: context.userAgent ?? undefined,
    });

    if (existing.status === "denied") {
      await reviewEventsDAL.createEvent({
        entityKind: "service_listing",
        entityId: listingId,
        eventType: "provider_resubmitted",
        actorUserId: providerId,
        note: null,
      });

      await sendListingPendingAdminNotification(updated);
    }

    return updated;
  }

  /**
   * Add one photo to a service listing (mobile Req 11.3.1, P-E10-4).
   *
   * **`service_listings.photos` is a `jsonb` array of URL strings**, not rows —
   * unlike `listing_images`, which carries ids, order indexes and blob
   * pathnames (mobile F17). So identity here IS the URL and order IS the array
   * order, which is why there is no per-photo id anywhere in this API. Keeping
   * the column as-is avoids a migration; the cost is that the two photo APIs do
   * not look alike, and the mobile photos section adapts rather than shares.
   *
   * Runs the same validation + processing pipeline as a rental image: magic-byte
   * check, re-encode to JPEG ≤2048px. Adding a photo does **not** change the
   * listing's moderation status — service listings have no equivalent of the
   * rental images-only re-review rule (Req 2.7.3 leaves service moderation
   * unchanged), so a photo added to an `active` listing stays live.
   */
  static async addPhoto(
    listingId: string,
    providerId: string,
    file: File,
    context: AuditContext,
  ): Promise<ServiceListing> {
    const existing = await serviceListingDAL.getById(listingId);
    if (!existing || existing.providerId !== providerId) {
      throw new ForbiddenError("You do not own this listing");
    }

    const photos = existing.photos ?? [];
    if (photos.length >= MAX_SERVICE_PHOTOS) {
      throw new ValidationError(
        `Maximum ${MAX_SERVICE_PHOTOS} photos per service listing`,
      );
    }

    const validationError = validateImageForProcessing(file, 10);
    if (validationError) throw new ValidationError(validationError);

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validateImageMagicBytes(buffer)) {
      throw new ValidationError("Invalid image file content");
    }

    const processed = await processImageForUpload(buffer, {
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 85,
      format: "jpeg",
    });

    const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `service-listings/${listingId}/${Date.now()}-${sanitized.replace(/\.[^/.]+$/, ".jpg")}`;
    const blob = await uploadToBlob(filename, processed);

    const updated = await serviceListingDAL.update(listingId, {
      photos: [...photos, blob.url],
    });

    await auditLogDAL.create({
      entityType: "service_listing",
      entityId: listingId,
      action: "service_listing.photo_added",
      userId: providerId,
      metadata: { count: updated.photos?.length ?? 0 },
      ipAddress: context.ipAddress ?? undefined,
      userAgent: context.userAgent ?? undefined,
    });

    return updated;
  }

  /**
   * Replace the photo array — this is BOTH reorder and remove (P-E10-4).
   *
   * One operation because the column has no per-photo identity to address: the
   * order is the array, and a removal is simply an absent URL.
   *
   * ⚠️ **The new array must be a subset of the current one.** Without that check
   * a provider could put ANY url in `photos`, and those render as images in
   * other members' clients — an arbitrary-URL injection into someone else's
   * feed, with the request-time tracking that implies. The guard is what makes
   * "the client sends the array it wants" safe.
   *
   * Blobs for dropped URLs are deleted after the row is written, and a failed
   * cleanup does not fail the request: an orphaned blob costs storage, whereas
   * a failed reorder that the provider already saw succeed costs trust.
   */
  static async setPhotos(
    listingId: string,
    providerId: string,
    photos: string[],
    context: AuditContext,
  ): Promise<ServiceListing> {
    const existing = await serviceListingDAL.getById(listingId);
    if (!existing || existing.providerId !== providerId) {
      throw new ForbiddenError("You do not own this listing");
    }

    const current = existing.photos ?? [];
    const currentSet = new Set(current);
    const unknown = photos.find((url) => !currentSet.has(url));
    if (unknown) {
      throw new ValidationError(
        "Photos can only be reordered or removed, not added this way",
      );
    }
    if (new Set(photos).size !== photos.length) {
      throw new ValidationError("Photos must be unique");
    }

    const updated = await serviceListingDAL.update(listingId, { photos });

    const removed = current.filter((url) => !photos.includes(url));
    if (removed.length > 0) {
      const { deleteFromBlob } = await import("@/services/vercel-blob");
      Promise.allSettled(
        removed.map((url) => deleteFromBlob(new URL(url).pathname.slice(1))),
      ).catch(() => undefined);
    }

    await auditLogDAL.create({
      entityType: "service_listing",
      entityId: listingId,
      action: "service_listing.photos_set",
      userId: providerId,
      metadata: { count: photos.length, removed: removed.length },
      ipAddress: context.ipAddress ?? undefined,
      userAgent: context.userAgent ?? undefined,
    });

    return updated;
  }

  /**
   * Provider deactivates a listing.
   */
  static async deactivateListing(
    listingId: string,
    providerId: string,
    context: AuditContext,
  ): Promise<void> {
    const existing = await serviceListingDAL.getById(listingId);
    if (!existing || existing.providerId !== providerId) {
      throw new ForbiddenError("You do not own this listing");
    }

    await serviceListingDAL.update(listingId, { status: "inactive" });

    await auditLogDAL.create({
      entityType: "service_listing",
      entityId: listingId,
      action: "service_listing.deactivated",
      userId: providerId,
      ipAddress: context.ipAddress ?? undefined,
      userAgent: context.userAgent ?? undefined,
    });
  }

  /**
   * Provider reactivates a previously deactivated listing.
   */
  static async reactivateListing(
    listingId: string,
    providerId: string,
    context: AuditContext,
  ): Promise<void> {
    const existing = await serviceListingDAL.getById(listingId);
    if (!existing || existing.providerId !== providerId) {
      throw new ForbiddenError("You do not own this listing");
    }
    if (existing.status !== "inactive") {
      throw new ValidationError(
        "Only inactive listings can be reactivated",
        "status",
      );
    }

    await serviceListingDAL.update(listingId, { status: "active" });

    await auditLogDAL.create({
      entityType: "service_listing",
      entityId: listingId,
      action: "service_listing.reactivated",
      userId: providerId,
      ipAddress: context.ipAddress ?? undefined,
      userAgent: context.userAgent ?? undefined,
    });
  }

  /**
   * Provider deletes their listing when no bookings exist.
   */
  static async deleteListing(
    listingId: string,
    providerId: string,
    context: AuditContext,
  ): Promise<void> {
    const existing = await serviceListingDAL.getById(listingId);
    if (!existing || existing.providerId !== providerId) {
      throw new ForbiddenError("You do not own this listing");
    }

    const bookingCount = await serviceBookingDAL.countByListingId(listingId);
    if (bookingCount > 0) {
      throw new ValidationError(
        "You cannot delete a listing that has bookings. Deactivate it instead.",
        "listingId",
      );
    }

    await reviewEventsDAL.deleteEventsForEntity("service_listing", listingId);
    await serviceListingDAL.delete(listingId);

    await auditLogDAL.create({
      entityType: "service_listing",
      entityId: listingId,
      action: "service_listing.deleted",
      userId: providerId,
      ipAddress: context.ipAddress ?? undefined,
      userAgent: context.userAgent ?? undefined,
    });
  }

  /**
   * Admin approves a pending listing.
   */
  static async approveListing(
    listingId: string,
    adminId: string,
    note?: string,
  ): Promise<ServiceListing> {
    const existing = await serviceListingDAL.getById(listingId);
    if (!existing) {
      throw new NotFoundError("Service listing", listingId);
    }

    if (existing.status !== "pending_approval") {
      throw new ValidationError(
        "Only pending listings can be approved",
        "status",
      );
    }

    const adminNoteToSave =
      note && note.trim().length > 0
        ? this.appendReviewScalar(existing.adminNote, note, "Approved note")
        : existing.adminNote;

    const updated = await serviceListingDAL.update(listingId, {
      status: "active",
      adminNote: adminNoteToSave,
    });

    await reviewEventsDAL.createEvent({
      entityKind: "service_listing",
      entityId: listingId,
      eventType: "approved",
      actorUserId: adminId,
      note: note?.trim() ? note.trim() : null,
    });

    await auditLogDAL.create({
      entityType: "service_listing",
      entityId: listingId,
      action: "service_listing.approved",
      userId: adminId,
      metadata: { providerId: existing.providerId },
      ipAddress: undefined,
      userAgent: undefined,
    });

    await sendListingApprovedNotification(existing.providerId, updated);

    after(async () => {
      await notifyRequesterListingLive("service", listingId).catch((err) =>
        captureNonCriticalError(err, {
          route: "ServiceListingService.approveListing",
          action: "notifyRequesterListingLive",
        }),
      );
    });

    return updated;
  }

  /**
   * Admin denies a listing with a required reason.
   */
  static async rejectListing(
    listingId: string,
    adminId: string,
    reason: string,
  ): Promise<ServiceListing> {
    const trimmed = reason.trim();
    if (!trimmed) {
      throw new ValidationError("Reason is required", "reason");
    }

    const existing = await serviceListingDAL.getById(listingId);
    if (!existing) {
      throw new NotFoundError("Service listing", listingId);
    }

    if (existing.status !== "pending_approval") {
      throw new ValidationError(
        "Only pending listings can be rejected",
        "status",
      );
    }

    const rejectionReasonToSave = this.appendReviewScalar(
      existing.rejectionReason,
      trimmed,
      "Rejection reason",
    );

    const updated = await serviceListingDAL.update(listingId, {
      status: "denied",
      rejectionReason: rejectionReasonToSave,
    });

    await reviewEventsDAL.createEvent({
      entityKind: "service_listing",
      entityId: listingId,
      eventType: "rejected",
      actorUserId: adminId,
      note: trimmed,
    });

    await auditLogDAL.create({
      entityType: "service_listing",
      entityId: listingId,
      action: "service_listing.rejected",
      userId: adminId,
      metadata: { providerId: existing.providerId },
      ipAddress: undefined,
      userAgent: undefined,
    });

    await sendListingRejectedNotification(
      existing.providerId,
      updated,
      trimmed,
    );

    return updated;
  }
}
