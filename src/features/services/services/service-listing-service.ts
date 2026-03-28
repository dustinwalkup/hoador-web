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

import type { AuditContext, CreateListingInput } from "../types";

export type CreateListingResult =
  | { success: true; listing: ServiceListing }
  | { success: false; error: "stripe_connect_required" };

async function assertProviderStripeConnect(
  providerId: string,
): Promise<boolean> {
  const profile = await userDAL.getUserById(providerId);
  if (!profile) {
    return false;
  }
  return Boolean(
    profile.stripeConnectedAccountId &&
    profile.connectChargesEnabled &&
    profile.connectPayoutsEnabled,
  );
}

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
   * Submits a new listing for admin approval.
   */
  static async createListing(
    formData: CreateListingInput,
    providerId: string,
    context: AuditContext,
  ): Promise<CreateListingResult> {
    const okConnect = await assertProviderStripeConnect(providerId);
    if (!okConnect) {
      return { success: false, error: "stripe_connect_required" };
    }

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
    // back into the admin review queue.
    if (existing.status === "denied") {
      patch.status = "pending_approval";
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
