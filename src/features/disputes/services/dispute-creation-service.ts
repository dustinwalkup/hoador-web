import {
  disputeDAL,
  rentalDAL,
  legalDocumentDAL,
  auditLogDAL,
  paymentLifecycleDAL,
  serviceBookingDAL,
  servicePaymentLifecycleDAL,
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
import { TimeWindowValidation } from "@/features/disputes/lib/time-window-validation";

const FILING_WINDOW_HOURS = 24;

/** Parameters accepted by {@link DisputeCreationService.createDispute}. */
export interface CreateDisputeParams {
  /** Exactly one of `rentalId` or `serviceBookingId` is required. */
  rentalId?: string;
  serviceBookingId?: string;
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
   * Create a new dispute for a rental or a service booking.
   *
   * @throws {NotFoundError} Rental/booking not found
   * @throws {ForbiddenError} User is not a participant
   * @throws {ConflictError} Active dispute already exists
   * @throws {ValidationError} Filing window, reason/role mismatch, rate limits, etc.
   */
  static async createDispute(
    params: CreateDisputeParams,
  ): Promise<CreateDisputeResult> {
    const { rentalId, serviceBookingId } = params;
    const hasRental = Boolean(rentalId);
    const hasService = Boolean(serviceBookingId);

    if (hasRental === hasService) {
      throw new ValidationError(
        "Provide exactly one of rentalId or serviceBookingId",
      );
    }

    if (hasRental) {
      return DisputeCreationService.createRentalDispute({
        ...params,
        rentalId: rentalId!,
      });
    }

    return DisputeCreationService.createServiceBookingDispute({
      ...params,
      serviceBookingId: serviceBookingId!,
    });
  }

  private static async createRentalDispute(
    params: CreateDisputeParams & { rentalId: string },
  ): Promise<CreateDisputeResult> {
    const { rentalId, reasonCode, description, userId, ipAddress, userAgent } =
      params;

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

    const isRenter = rental.renterId === userId;
    const isProvider = rental.ownerId === userId;
    if (!isRenter && !isProvider) {
      throw new ForbiddenError(
        "You can only create disputes for your own rentals",
      );
    }
    const createdByRole: DisputeRole = isRenter ? "renter" : "owner";

    const existingDispute =
      await disputeDAL.getActiveByRentalId(actualRentalId);
    if (existingDispute) {
      throw new ConflictError(
        "An active dispute already exists for this rental",
      );
    }

    const priorDispute = await disputeDAL.getAnyByRentalId(actualRentalId);
    if (
      priorDispute &&
      (priorDispute.status === "resolved" || priorDispute.status === "closed")
    ) {
      throw new ConflictError(
        "A dispute for this rental has already been resolved",
      );
    }

    const filingCheck =
      await disputeDAL.validateFilingWindowUnified(actualRentalId);
    if (!filingCheck.valid) {
      throw new ValidationError(
        filingCheck.message ?? "Filing window has expired",
      );
    }

    const rateLimits = await disputeDAL.checkRateLimits(userId);
    if (!rateLimits.withinLimits) {
      throw new ValidationError(
        `Rate limit exceeded (${rateLimits.monthlyCount}/3 monthly, ${rateLimits.yearlyCount}/10 yearly)`,
      );
    }

    const disputePolicy = await legalDocumentDAL.getCurrentVersion(
      LEGAL_DOCUMENT_IDS.DISPUTE_POLICY,
    );
    const policyVersion = disputePolicy?.version || "v1.0";

    let dispute: Awaited<ReturnType<typeof disputeDAL.create>>;
    try {
      dispute = await disputeDAL.create({
        rentalId: actualRentalId,
        serviceBookingId: null,
        createdBy: userId,
        createdByRole,
        reasonCode,
        description,
        policyVersion,
      });
    } catch (err) {
      if (err instanceof ConflictError) {
        throw new ConflictError("A dispute for this rental already exists");
      }
      throw err;
    }

    await paymentLifecycleDAL.freezeForDispute(actualRentalId);

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

    try {
      await sendDisputeNotifications(dispute, "created");
    } catch (error) {
      console.error("Failed to send dispute creation notifications:", error);
    }

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

  private static validateServiceReasonAndRole(
    reasonCode: DisputeReasonCode,
    createdByRole: DisputeRole,
  ): void {
    if (reasonCode === "requester_no_show" && createdByRole !== "provider") {
      throw new ValidationError(
        'Reason "Requester no-show" can only be selected when filing as the provider',
        "reasonCode",
      );
    }
    if (reasonCode === "provider_no_show" && createdByRole !== "requester") {
      throw new ValidationError(
        'Reason "Provider no-show" can only be selected when filing as the client',
        "reasonCode",
      );
    }
  }

  private static async createServiceBookingDispute(
    params: CreateDisputeParams & { serviceBookingId: string },
  ): Promise<CreateDisputeResult> {
    const {
      serviceBookingId,
      reasonCode,
      description,
      userId,
      ipAddress,
      userAgent,
    } = params;

    const detail = await serviceBookingDAL.getById(serviceBookingId);
    if (!detail) {
      throw new NotFoundError("Service booking", serviceBookingId);
    }

    if (detail.status !== "accepted" && detail.status !== "completed") {
      throw new ValidationError(
        "Disputes can only be filed for accepted or completed service bookings",
        "status",
      );
    }

    const isRequester = detail.requesterId === userId;
    const isProvider = detail.providerId === userId;
    if (!isRequester && !isProvider) {
      throw new ForbiddenError(
        "You can only create disputes for your own service bookings",
      );
    }

    const createdByRole: DisputeRole = isRequester ? "requester" : "provider";
    DisputeCreationService.validateServiceReasonAndRole(
      reasonCode,
      createdByRole,
    );

    if (
      detail.status === "completed" &&
      (reasonCode === "provider_no_show" || reasonCode === "requester_no_show")
    ) {
      throw new ValidationError(
        `Cannot file "${reasonCode}" on a completed service booking`,
        "reasonCode",
      );
    }

    const existing =
      await disputeDAL.getActiveByServiceBookingId(serviceBookingId);
    if (existing) {
      throw new ConflictError(
        "An active dispute already exists for this service booking",
      );
    }

    const priorServiceDispute =
      await disputeDAL.getAnyByServiceBookingId(serviceBookingId);
    if (
      priorServiceDispute &&
      (priorServiceDispute.status === "resolved" ||
        priorServiceDispute.status === "closed")
    ) {
      throw new ConflictError(
        "A dispute for this service booking has already been resolved",
      );
    }

    const pd = detail.proposedDate as string | Date;
    const proposedDateStr =
      typeof pd === "string" ? pd : pd.toISOString().slice(0, 10);

    const window = TimeWindowValidation.validateServiceFilingWindow(
      proposedDateStr,
      detail.proposedTime,
      detail.completedAt ?? null,
    );
    if (!window.valid) {
      // S12: If booking was never marked completed and scheduled time has passed,
      // allow the dispute to be filed but alert ops so the booking can be reviewed.
      if (!detail.completedAt) {
        await sendOpsAlert({
          event: "dispute_filed_incomplete_booking",
          serviceBookingId,
          message:
            "Dispute filed on a service booking that was never marked completed past its scheduled time",
          metadata: { serviceBookingId, userId, reasonCode },
        }).catch(() => {
          /* non-critical */
        });
        // Allow the filing to proceed — ops will review the incomplete booking
      } else {
        throw new ValidationError(
          window.message ?? "Filing window has expired",
          "status",
        );
      }
    }

    const rateLimits = await disputeDAL.checkRateLimits(userId);
    if (!rateLimits.withinLimits) {
      throw new ValidationError(
        `Rate limit exceeded (${rateLimits.monthlyCount}/3 monthly, ${rateLimits.yearlyCount}/10 yearly)`,
      );
    }

    const lifecycle =
      await servicePaymentLifecycleDAL.getByBookingId(serviceBookingId);
    if (lifecycle?.ownerTransferStatus === "completed") {
      await sendOpsAlert({
        event: "dispute_filed_post_payout",
        serviceBookingId,
        message:
          "Dispute filed after provider payout already completed — manual refund required",
        metadata: { serviceBookingId, userId, reasonCode },
      }).catch(() => {
        /* non-critical */
      });
      throw new ConflictError(
        "Provider payout was already transferred. An admin will manually review and issue a refund if applicable.",
      );
    }

    const disputePolicy = await legalDocumentDAL.getCurrentVersion(
      LEGAL_DOCUMENT_IDS.DISPUTE_POLICY,
    );
    const policyVersion = disputePolicy?.version || "v1.0";

    let dispute: Awaited<ReturnType<typeof disputeDAL.create>>;
    try {
      dispute = await disputeDAL.create({
        rentalId: null,
        serviceBookingId,
        createdBy: userId,
        createdByRole,
        reasonCode,
        description,
        policyVersion,
      });
    } catch (err) {
      if (err instanceof ConflictError) {
        throw new ConflictError(
          "A dispute for this service booking already exists",
        );
      }
      throw err;
    }

    await servicePaymentLifecycleDAL.freezeForDispute(serviceBookingId);

    await auditLogDAL.create({
      entityType: "dispute",
      entityId: dispute.id,
      action: "dispute.opened",
      userId,
      metadata: { reasonCode, createdByRole, serviceBookingId },
      ipAddress,
      userAgent,
    });

    await disputeDAL.createAuditLog({
      disputeId: dispute.id,
      actionType: "dispute_created",
      userId,
      details: { reasonCode, createdByRole, serviceBookingId },
    });

    try {
      await sendDisputeNotifications(dispute, "created");
    } catch (error) {
      console.error("Failed to send dispute creation notifications:", error);
    }

    await sendOpsAlert({
      event: "dispute_created",
      serviceBookingId,
      message: `Service dispute filed by ${createdByRole}: ${reasonCode}`,
      metadata: {
        disputeId: dispute.id,
        reasonCode,
        createdByRole,
      },
    }).catch(() => {
      /* non-critical */
    });

    return { dispute };
  }
}
