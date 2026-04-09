import {
  disputeDAL,
  auditLogDAL,
  paymentLifecycleDAL,
  rentalDAL,
  servicePaymentLifecycleDAL,
} from "@/dal";
import { NotFoundError, ValidationError } from "@/dal/errors";
import type {
  DisputeResolutionOutcome,
  DisputeWithRelations,
  FinancialOperationStatus,
} from "@/dal/types";
import { releaseSecurityDeposit } from "@/services/stripe/rental-payments";
import { sendDisputeNotifications } from "@/features/disputes/notifications/dispute-notifications";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
import { PAYMENT_SERVER_INSTANCE } from "@/services/stripe/server";

type DepositAction = "capture_full" | "capture_partial" | "release" | "skip";

interface DepositOperation {
  action: DepositAction;
  /** Amount in dollars for partial capture. */
  partialAmountDollars?: number;
}

/** Parameters accepted by {@link DisputeResolutionService.resolveDispute}. */
export interface ResolveDisputeParams {
  disputeId: string;
  outcome: DisputeResolutionOutcome;
  reason: string;
  adminId: string;
  /** Required for partial_provider / partial_renter — amount in dollars to capture. */
  partialAmount?: number;
}

/** Successful result from {@link DisputeResolutionService.resolveDispute}. */
export interface ResolveDisputeResult {
  dispute: DisputeWithRelations;
  depositOperationStatus: "captured" | "released" | "skipped" | "failed";
}

/**
 * Determine which deposit operation to perform for a given resolution outcome.
 *
 * | Outcome          | Deposit held → action     |
 * |------------------|---------------------------|
 * | favor_provider   | capture_full              |
 * | favor_renter     | release                   |
 * | partial_provider | capture_partial            |
 * | partial_renter   | capture_partial            |
 * | dismissed        | release                   |
 */
export function getDepositOperationForOutcome(
  outcome: DisputeResolutionOutcome,
  depositHoldStatus: string,
  partialAmountDollars?: number,
): DepositOperation {
  if (depositHoldStatus !== "held") {
    return { action: "skip" };
  }

  switch (outcome) {
    case "favor_provider":
      return { action: "capture_full" };
    case "favor_renter":
    case "dismissed":
      return { action: "release" };
    case "partial_provider":
    case "partial_renter":
      return { action: "capture_partial", partialAmountDollars };
    default:
      return { action: "skip" };
  }
}

/**
 * Orchestrates dispute resolution: financial operations (deposit capture/release),
 * dispute status update, owner transfer unfreeze, audit logging, and notifications.
 *
 * Key invariant: if a financial operation fails, the dispute is NOT resolved and
 * the owner transfer is NOT unfrozen.
 */
export class DisputeResolutionService {
  /**
   * Resolve a dispute with the given outcome, executing corresponding financial
   * operations and unfreezing the owner transfer.
   *
   * @throws {NotFoundError} Dispute not found
   * @throws {ValidationError} Dispute already resolved/closed, or missing partial amount
   */
  static async resolveDispute(
    params: ResolveDisputeParams,
  ): Promise<ResolveDisputeResult> {
    const { disputeId, outcome, reason, adminId, partialAmount } = params;

    // --- 1. Load and validate ---
    const dispute = await disputeDAL.getById(disputeId);
    if (!dispute) {
      throw new NotFoundError("Dispute", disputeId);
    }

    if (dispute.status === "resolved" || dispute.status === "closed") {
      throw new ValidationError(
        `Dispute is already ${dispute.status} and cannot be resolved again`,
      );
    }

    if (
      (outcome === "partial_provider" || outcome === "partial_renter") &&
      !partialAmount
    ) {
      throw new ValidationError(
        "Partial amount is required for partial_provider or partial_renter outcomes",
      );
    }

    /** Service bookings: no rental deposit; unfreeze provider payout only. */
    if (dispute.serviceBookingId) {
      return DisputeResolutionService.resolveServiceBookingDispute({
        dispute,
        disputeId,
        outcome,
        reason,
        adminId,
        partialAmount,
      });
    }

    if (!dispute.rentalId) {
      throw new ValidationError("Dispute has no rental or service booking");
    }

    const lifecycle = await paymentLifecycleDAL.getByRentalId(dispute.rentalId);
    const depositHoldStatus = lifecycle?.depositHoldStatus ?? "not_applicable";

    if (
      (outcome === "partial_provider" || outcome === "partial_renter") &&
      partialAmount != null
    ) {
      const maxDeposit = await rentalDAL.getSecurityDepositAmount(
        dispute.rentalId,
      );
      if (maxDeposit != null && partialAmount > maxDeposit) {
        throw new ValidationError(
          `Partial amount ($${partialAmount}) exceeds the authorized security deposit ($${maxDeposit})`,
          "partialAmount",
        );
      }
    }

    // --- 2. Determine and execute financial operations ---
    const depositOp = getDepositOperationForOutcome(
      outcome,
      depositHoldStatus,
      partialAmount,
    );
    let depositOperationStatus: ResolveDisputeResult["depositOperationStatus"];

    const securityDepositAuthId = await rentalDAL.getSecurityDepositAuthId(
      dispute.rentalId,
    );

    if (depositOp.action === "skip") {
      depositOperationStatus = "skipped";

      await disputeDAL.createFinancialOperation({
        disputeId,
        operationType: "capture_deposit",
        status: "failed",
        errorMessage:
          depositHoldStatus === "not_applicable"
            ? "No security deposit on this rental"
            : `Deposit hold status is '${depositHoldStatus}' — cannot capture or release`,
        performedBy: adminId,
      });
    } else if (
      depositOp.action === "capture_full" ||
      depositOp.action === "capture_partial"
    ) {
      depositOperationStatus = await this.executeCapture(
        dispute,
        securityDepositAuthId,
        depositOp,
        adminId,
      );
    } else {
      depositOperationStatus = await this.executeRelease(
        dispute,
        securityDepositAuthId,
        adminId,
      );
    }

    if (depositOperationStatus === "failed") {
      await sendOpsAlert({
        event: "dispute_financial_op_failed",
        rentalId: dispute.rentalId,
        message: `Deposit operation failed during resolution of dispute ${disputeId}`,
        metadata: { disputeId, outcome, depositHoldStatus },
        sendEmailAlert: true,
      }).catch(() => {});

      throw new ValidationError(
        "Financial operation failed — dispute not resolved. Ops has been notified.",
      );
    }

    // --- 3. Resolve dispute ---
    const resolvedDispute = await disputeDAL.resolve(
      disputeId,
      outcome,
      reason,
      adminId,
    );

    // --- 4. Unfreeze owner transfer ---
    await paymentLifecycleDAL.unfreezeAfterResolution(dispute.rentalId);

    // --- 5. Audit logs ---
    await disputeDAL.createAuditLog({
      disputeId,
      actionType: "resolution",
      userId: adminId,
      previousState: dispute.status,
      newState: "resolved",
      details: {
        outcome,
        depositOperation: depositOp.action,
        depositOperationStatus,
        partialAmount,
      },
      reason,
    });

    await auditLogDAL.create({
      entityType: "dispute",
      entityId: disputeId,
      action: "dispute.resolved",
      userId: adminId,
      metadata: {
        previousStatus: dispute.status,
        newStatus: "resolved",
        resolutionOutcome: outcome,
        depositOperation: depositOp.action,
      },
    });

    // --- 6. Notifications (non-blocking) ---
    try {
      const disputeWithRelations = await disputeDAL.getById(disputeId);
      if (disputeWithRelations) {
        await sendDisputeNotifications(disputeWithRelations, "resolved");
      }
    } catch (error) {
      console.error("Failed to send dispute resolution notifications:", error);
    }

    // --- 7. Ops alert ---
    await sendOpsAlert({
      event: "dispute_resolved",
      rentalId: dispute.rentalId,
      message: `Dispute resolved: ${outcome}`,
      metadata: { disputeId, outcome, depositOperationStatus },
      sendEmailAlert: true,
    }).catch(() => {});

    return { dispute: resolvedDispute, depositOperationStatus };
  }

  /**
   * Resolve a service-booking dispute with outcome-based financial operations.
   *
   * | Outcome          | Financial action                                    |
   * |------------------|-----------------------------------------------------|
   * | favor_provider   | Unfreeze lifecycle; cron pays out provider          |
   * | favor_renter     | Full Stripe refund to requester; lifecycle closed   |
   * | partial_provider | Partial refund to requester; reduce providerPayout  |
   * | partial_renter   | Same as partial_provider                            |
   * | dismissed        | Unfreeze lifecycle; cron pays out provider          |
   */
  private static async resolveServiceBookingDispute(args: {
    dispute: DisputeWithRelations;
    disputeId: string;
    outcome: DisputeResolutionOutcome;
    reason: string;
    adminId: string;
    partialAmount?: number;
  }): Promise<ResolveDisputeResult> {
    const { dispute, disputeId, outcome, reason, adminId, partialAmount } =
      args;
    const bookingId = dispute.serviceBookingId;
    if (!bookingId) {
      throw new ValidationError("Missing service booking on dispute");
    }

    const lifecycle =
      await servicePaymentLifecycleDAL.getByBookingId(bookingId);

    if (
      (outcome === "partial_provider" || outcome === "partial_renter") &&
      partialAmount != null &&
      lifecycle?.providerPayout != null
    ) {
      const maxRefund = Number(lifecycle.providerPayout);
      if (partialAmount > maxRefund) {
        throw new ValidationError(
          `Partial refund ($${partialAmount}) exceeds the provider payout ($${maxRefund})`,
          "partialAmount",
        );
      }
    }

    // --- Financial operations based on outcome ---
    let refundOperationStatus: "refunded" | "skipped" | "failed" = "skipped";

    // favor_renter = favor the requester for service bookings (shared enum)
    if (outcome === "favor_renter") {
      refundOperationStatus =
        await DisputeResolutionService.executeServiceRefund(
          dispute,
          lifecycle?.chargeId ?? null,
          null, // full refund
          adminId,
        );

      if (refundOperationStatus === "failed") {
        await sendOpsAlert({
          event: "dispute_financial_op_failed",
          serviceBookingId: bookingId,
          message: `Service refund failed during resolution of dispute ${disputeId}`,
          metadata: { disputeId, outcome },
          sendEmailAlert: true,
        }).catch(() => {});

        throw new ValidationError(
          "Refund operation failed — dispute not resolved. Ops has been notified.",
        );
      }

      await servicePaymentLifecycleDAL.markRefundedAfterDispute(bookingId);
    } else if (outcome === "partial_provider" || outcome === "partial_renter") {
      // partialAmount is the amount to refund to the requester (in dollars)
      const refundAmountDollars = partialAmount ?? 0;

      refundOperationStatus =
        await DisputeResolutionService.executeServiceRefund(
          dispute,
          lifecycle?.chargeId ?? null,
          refundAmountDollars,
          adminId,
        );

      if (refundOperationStatus === "failed") {
        await sendOpsAlert({
          event: "dispute_financial_op_failed",
          serviceBookingId: bookingId,
          message: `Partial service refund failed during resolution of dispute ${disputeId}`,
          metadata: { disputeId, outcome, refundAmountDollars },
          sendEmailAlert: true,
        }).catch(() => {});

        throw new ValidationError(
          "Partial refund operation failed — dispute not resolved. Ops has been notified.",
        );
      }

      // Reduce provider payout by the refunded amount
      const currentPayout = Number(lifecycle?.providerPayout ?? 0);
      const newProviderPayout = Math.max(
        0,
        currentPayout - refundAmountDollars,
      );
      await servicePaymentLifecycleDAL.updateProviderPayout(
        bookingId,
        newProviderPayout,
      );
      await servicePaymentLifecycleDAL.unfreezeAfterResolution(bookingId);
    } else {
      // favor_provider or dismissed — provider receives full payout
      await servicePaymentLifecycleDAL.unfreezeAfterResolution(bookingId);
    }

    const resolvedDispute = await disputeDAL.resolve(
      disputeId,
      outcome,
      reason,
      adminId,
    );

    await disputeDAL.createAuditLog({
      disputeId,
      actionType: "resolution",
      userId: adminId,
      previousState: dispute.status,
      newState: "resolved",
      details: {
        outcome,
        partialAmount,
        refundOperationStatus,
        context: "service_booking",
      },
      reason,
    });

    await auditLogDAL.create({
      entityType: "dispute",
      entityId: disputeId,
      action: "dispute.resolved",
      userId: adminId,
      metadata: {
        previousStatus: dispute.status,
        newStatus: "resolved",
        resolutionOutcome: outcome,
        refundOperationStatus,
      },
    });

    try {
      const disputeWithRelations = await disputeDAL.getById(disputeId);
      if (disputeWithRelations) {
        await sendDisputeNotifications(disputeWithRelations, "resolved");
      }
    } catch (error) {
      console.error("Failed to send dispute resolution notifications:", error);
    }

    await sendOpsAlert({
      event: "dispute_resolved",
      serviceBookingId: bookingId,
      message: `Service dispute resolved: ${outcome}`,
      metadata: { disputeId, outcome, refundOperationStatus },
      sendEmailAlert: true,
    }).catch(() => {});

    return { dispute: resolvedDispute, depositOperationStatus: "skipped" };
  }

  /**
   * Issue a Stripe refund for a service booking charge.
   * @param chargeId Stripe charge ID from the service payment lifecycle
   * @param refundAmountDollars Dollars to refund; null = full refund
   */
  private static async executeServiceRefund(
    dispute: DisputeWithRelations,
    chargeId: string | null,
    refundAmountDollars: number | null,
    adminId: string,
  ): Promise<"refunded" | "failed"> {
    const operationType =
      refundAmountDollars !== null ? "refund_partial" : "refund_full";

    if (!chargeId) {
      await disputeDAL.createFinancialOperation({
        disputeId: dispute.id,
        operationType,
        status: "failed",
        errorMessage: "No Stripe charge ID on service payment lifecycle",
        performedBy: adminId,
      });
      return "failed";
    }

    try {
      const refundParams: { charge: string; amount?: number } = {
        charge: chargeId,
      };
      if (refundAmountDollars !== null) {
        refundParams.amount = Math.round(refundAmountDollars * 100);
      }

      const refund = await PAYMENT_SERVER_INSTANCE.refunds.create(
        refundParams,
        {
          idempotencyKey: `service-refund-${dispute.id}${refundAmountDollars !== null ? `-partial` : ""}`,
        },
      );

      await disputeDAL.createFinancialOperation({
        disputeId: dispute.id,
        operationType,
        amount:
          refundAmountDollars !== null
            ? refundAmountDollars.toString()
            : undefined,
        stripeOperationId: refund.id,
        status: "succeeded",
        performedBy: adminId,
      });

      return "refunded";
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Service booking refund failed:", error);

      await disputeDAL.createFinancialOperation({
        disputeId: dispute.id,
        operationType,
        status: "failed",
        errorMessage,
        performedBy: adminId,
      });

      return "failed";
    }
  }

  /**
   * Capture the security deposit (full or partial) with idempotency.
   * Updates lifecycle on success; records failure in dispute_financial_operations.
   */
  private static async executeCapture(
    dispute: DisputeWithRelations,
    securityDepositAuthId: string | null,
    depositOp: DepositOperation,
    adminId: string,
  ): Promise<"captured" | "failed"> {
    const rentalId = dispute.rentalId!;
    if (!securityDepositAuthId) {
      await disputeDAL.createFinancialOperation({
        disputeId: dispute.id,
        operationType: "capture_deposit",
        status: "failed",
        errorMessage: "Security deposit authorization not found for rental",
        performedBy: adminId,
      });
      return "failed";
    }

    try {
      const captureAmount =
        depositOp.action === "capture_partial"
          ? depositOp.partialAmountDollars
          : undefined;

      const paymentIntent =
        await PAYMENT_SERVER_INSTANCE.paymentIntents.capture(
          securityDepositAuthId,
          captureAmount != null
            ? { amount_to_capture: Math.round(captureAmount * 100) }
            : {},
          { idempotencyKey: `deposit-capture-${dispute.id}` },
        );

      await paymentLifecycleDAL.markDepositCaptured(rentalId);

      await disputeDAL.createFinancialOperation({
        disputeId: dispute.id,
        operationType: "capture_deposit",
        amount: captureAmount != null ? captureAmount.toString() : undefined,
        stripeOperationId: paymentIntent.id,
        stripePaymentIntentId: paymentIntent.id,
        status: "succeeded",
        performedBy: adminId,
      });

      return "captured";
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Deposit capture failed:", error);

      await disputeDAL.createFinancialOperation({
        disputeId: dispute.id,
        operationType: "capture_deposit",
        status: "failed",
        errorMessage,
        performedBy: adminId,
      });

      return "failed";
    }
  }

  /**
   * Release the security deposit hold.
   * Updates lifecycle on success; records failure in dispute_financial_operations.
   */
  private static async executeRelease(
    dispute: DisputeWithRelations,
    securityDepositAuthId: string | null,
    adminId: string,
  ): Promise<"released" | "failed"> {
    const rentalId = dispute.rentalId!;
    if (!securityDepositAuthId) {
      await disputeDAL.createFinancialOperation({
        disputeId: dispute.id,
        operationType: "capture_deposit",
        status: "failed",
        errorMessage:
          "Security deposit authorization not found for rental — cannot release",
        performedBy: adminId,
      });
      return "failed";
    }

    try {
      await releaseSecurityDeposit(securityDepositAuthId);

      await paymentLifecycleDAL.updateDepositHoldStatus(rentalId, "released", {
        depositReleasedAt: new Date(),
      });

      await disputeDAL.createFinancialOperation({
        disputeId: dispute.id,
        operationType: "capture_deposit",
        stripePaymentIntentId: securityDepositAuthId,
        status: "succeeded" as FinancialOperationStatus,
        performedBy: adminId,
      });

      return "released";
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Deposit release failed:", error);

      await disputeDAL.createFinancialOperation({
        disputeId: dispute.id,
        operationType: "capture_deposit",
        status: "failed",
        errorMessage,
        performedBy: adminId,
      });

      return "failed";
    }
  }
}
