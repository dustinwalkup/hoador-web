import { auditLogDAL, serviceListingDAL, userDAL } from "@/dal";
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

    const updated = await serviceListingDAL.update(listingId, {
      status: "active",
      adminNote: note ?? existing.adminNote,
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

    const updated = await serviceListingDAL.update(listingId, {
      status: "denied",
      rejectionReason: trimmed,
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
