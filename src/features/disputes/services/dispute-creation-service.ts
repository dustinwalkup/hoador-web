import {
  disputeDAL,
  rentalDAL,
  legalDocumentDAL,
  auditLogDAL,
  paymentLifecycleDAL,
} from "@/dal";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from "@/dal/errors";
import type {
  DisputeReasonCode,
  DisputeRole,
  DisputeWithRelations,
} from "@/dal/types";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { sendDisputeNotifications } from "@/features/disputes/notifications/dispute-notifications";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";

const FILING_WINDOW_HOURS = 24;

/** Parameters accepted by {@link DisputeCreationService.createDispute}. */
export interface CreateDisputeParams {
  rentalId: string;
  reasonCode: DisputeReasonCode;
  description: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

/** Successful result from {@link DisputeCreationService.createDispute}. */
export interface CreateDisputeResult {
  dispute: DisputeWithRelations;
}

/**
 * Validate whether the dispute filing window is currently open for a rental.
 *
 * Rules (Phase 3 unified window):
 *  - If `returnConfirmedAt` is set: `now <= returnConfirmedAt + 24h`
 *  - If `returnConfirmedAt` is NOT set: `now >= startDate`
 *
 * @returns `{ valid: true }` or `{ valid: false, message: string }`
 */
export function validateFilingWindow(
  startDate: Date,
  returnConfirmedAt: Date | null,
  now: Date = new Date(),
): { valid: true } | { valid: false; message: string } {
  if (returnConfirmedAt) {
    const deadline = new Date(
      returnConfirmedAt.getTime() + FILING_WINDOW_HOURS * 60 * 60 * 1000,
    );
    if (now > deadline) {
      return {
        valid: false,
        message:
          "The dispute filing window closed 24 hours after the return was confirmed",
      };
    }
    return { valid: true };
  }

  if (now < startDate) {
    return {
      valid: false,
      message: "Disputes cannot be filed before the rental start date",
    };
  }

  return { valid: true };
}

/**
 * Orchestrates dispute creation: validation, persistence, payout freeze,
 * audit logging, and notifications.
 *
 * Follows the same pattern as CancellationService — pure orchestration over
 * DAL calls and side-effects, throwing typed errors for the route to map to
 * HTTP status codes.
 */
export class DisputeCreationService {
  /**
   * Create a new dispute for a rental.
   *
   * @throws {NotFoundError} Rental not found or request not yet approved
   * @throws {ForbiddenError} User is not renter or owner
   * @throws {ConflictError} Active dispute already exists for this rental
   * @throws {ValidationError} Filing window expired, rate limits exceeded, etc.
   */
  static async createDispute(
    params: CreateDisputeParams,
  ): Promise<CreateDisputeResult> {
    const { rentalId, reasonCode, description, userId, ipAddress, userAgent } =
      params;

    // --- 1. Load rental and resolve actual rental ID ---
    const rental = await rentalDAL.getRentalDetailsById(rentalId, userId);
    if (!rental) {
      throw new NotFoundError("Rental", rentalId);
    }

    let actualRentalId = rentalId;
    if (rental.type === "request") {
      const actualRental = await rentalDAL.getRentalByRequestId(rental.id);
      if (!actualRental) {
        throw new ValidationError(
          "Cannot create dispute for a rental request that has not been approved",
        );
      }
      actualRentalId = actualRental.id;
    }

    // --- 2. Authorization: user must be renter or owner ---
    const isRenter = rental.renterId === userId;
    const isProvider = rental.ownerId === userId;
    if (!isRenter && !isProvider) {
      throw new ForbiddenError(
        "You can only create disputes for your own rentals",
      );
    }
    const createdByRole: DisputeRole = isRenter ? "renter" : "provider";

    // --- 3. No duplicate active dispute ---
    const existingDispute =
      await disputeDAL.getActiveByRentalId(actualRentalId);
    if (existingDispute) {
      throw new ConflictError(
        "An active dispute already exists for this rental",
      );
    }

    // --- 4. Unified filing window validation ---
    const filingCheck =
      await disputeDAL.validateFilingWindowUnified(actualRentalId);
    if (!filingCheck.valid) {
      throw new ValidationError(
        filingCheck.message ?? "Filing window has expired",
      );
    }

    // --- 5. Rate limits ---
    const rateLimits = await disputeDAL.checkRateLimits(userId);
    if (!rateLimits.withinLimits) {
      throw new ValidationError(
        `Rate limit exceeded (${rateLimits.monthlyCount}/3 monthly, ${rateLimits.yearlyCount}/10 yearly)`,
      );
    }

    // --- 6. Get current legal policy version ---
    const disputePolicy = await legalDocumentDAL.getCurrentVersion(
      LEGAL_DOCUMENT_IDS.DISPUTE_POLICY,
    );
    const policyVersion = disputePolicy?.version || "v1.0";

    // --- 7. Create dispute ---
    const dispute = await disputeDAL.create({
      rentalId: actualRentalId,
      createdBy: userId,
      createdByRole,
      reasonCode,
      description,
      policyVersion,
    });

    // --- 8. Freeze owner transfer ---
    await paymentLifecycleDAL.freezeForDispute(actualRentalId);

    // --- 9. Audit logs ---
    await auditLogDAL.create({
      entityType: "dispute",
      entityId: dispute.id,
      action: "dispute.opened",
      userId,
      metadata: { reasonCode, createdByRole },
      ipAddress,
      userAgent,
    });

    await disputeDAL.createAuditLog({
      disputeId: dispute.id,
      actionType: "dispute_created",
      userId,
      details: { reasonCode, createdByRole },
    });

    // --- 10. Notifications (non-blocking) ---
    try {
      await sendDisputeNotifications(dispute, "created");
    } catch (error) {
      console.error("Failed to send dispute creation notifications:", error);
    }

    // --- 11. Ops alert ---
    await sendOpsAlert({
      event: "dispute_created",
      rentalId: actualRentalId,
      message: `Dispute filed by ${createdByRole}: ${reasonCode}`,
      metadata: { disputeId: dispute.id, reasonCode, createdByRole },
    }).catch(() => {
      /* non-critical */
    });

    return { dispute };
  }
}
