import { PAYMENT_SERVER_INSTANCE } from "./server";
import { auditLogDAL } from "@/dal";
import { DisputeDAL } from "@/dal/dispute.dal";
import { PaymentDAL } from "@/dal/payment.dal";
import { RentalDAL } from "@/dal/rentals.dal";
import { PaymentLifecycleDAL } from "@/dal/payment-lifecycle.dal";
import type { DisputeWithRelations, FinancialOperationType } from "@/dal/types";
import { disputeFinancialOperations } from "@/db/schemas/disputes.schema";
import type { InferSelectModel } from "drizzle-orm";

/**
 * Financial operation input for dispute resolution
 */
export interface FinancialOperationInput {
  type: FinancialOperationType;
  amount?: number; // For partial refunds, in dollars
}

/**
 * Financial operation record type
 */
type FinancialOperationRecord = InferSelectModel<
  typeof disputeFinancialOperations
>;

/**
 * Stripe dispute financial service
 * Handles all financial operations related to disputes (refunds, payout holds, deposit captures)
 */
export class StripeDisputeService {
  private static disputeDAL = new DisputeDAL();
  private static paymentDAL = new PaymentDAL();
  private static rentalDAL = new RentalDAL();
  private static paymentLifecycleDAL = new PaymentLifecycleDAL();

  /**
   * Execute financial operation for dispute
   * Routes to appropriate handler based on operation type
   *
   * @param dispute - The dispute record
   * @param operation - The financial operation to execute
   * @param performedBy - The user ID who is performing the operation
   * @returns The created financial operation record
   */
  static async executeOperation(
    dispute: DisputeWithRelations,
    operation: FinancialOperationInput,
    performedBy: string,
  ): Promise<FinancialOperationRecord> {
    // Verify dispute has rental relation
    if (!dispute.rental) {
      throw new Error("Dispute must have rental relation");
    }

    switch (operation.type) {
      case "refund_full":
      case "refund_partial":
        return this.createRefund(dispute, operation, performedBy);
      case "hold_payout":
        return this.holdPayout(dispute, performedBy);
      case "capture_deposit":
        return this.captureDeposit(dispute, performedBy, operation.amount);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Create refund (full or partial)
   * Handles both 'refund_full' and 'refund_partial' operation types
   * Creates a Stripe refund and records the financial operation
   *
   * @param dispute - The dispute record with rental relation
   * @param operation - The refund operation (type and optional amount for partial refunds)
   * @param performedBy - The user ID who is performing the operation
   * @returns The created financial operation record
   * @throws {Error} If payment record not found, payment intent missing, or invalid refund amount
   */
  private static async createRefund(
    dispute: DisputeWithRelations,
    operation: FinancialOperationInput,
    performedBy: string,
  ): Promise<FinancialOperationRecord> {
    try {
      // Get payment record from rental
      const payment = await this.paymentDAL.getByRentalId(dispute.rentalId);

      if (!payment) {
        throw new Error("Payment record not found for rental");
      }

      if (!payment.stripePaymentIntentId) {
        throw new Error("Payment intent ID not found for rental payment");
      }

      // Calculate refund amount
      const paymentAmount = parseFloat(payment.amount);
      const refundAmount =
        operation.type === "refund_full"
          ? paymentAmount
          : operation.amount || paymentAmount;

      if (refundAmount <= 0 || refundAmount > paymentAmount) {
        throw new Error(
          `Invalid refund amount: ${refundAmount}. Must be between 0 and ${paymentAmount}`,
        );
      }

      // Create refund via Stripe API
      const refund = await PAYMENT_SERVER_INSTANCE.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: Math.round(refundAmount * 100), // Convert to cents
        metadata: {
          disputeId: dispute.id,
          rentalId: dispute.rentalId,
          operationType: operation.type,
        },
      });

      // Create financial operation record
      const financialOperation = await this.disputeDAL.createFinancialOperation(
        {
          disputeId: dispute.id,
          operationType: operation.type,
          amount: refundAmount.toString(),
          stripeOperationId: refund.id,
          stripePaymentIntentId: payment.stripePaymentIntentId,
          status: "succeeded",
          performedBy,
        },
      );

      await auditLogDAL.create({
        entityType: "payment",
        entityId: payment.stripePaymentIntentId,
        action: "payment.refunded",
        userId: performedBy,
        metadata: {
          amount: refundAmount,
          currency: "usd",
          status: "succeeded",
        },
      });

      return financialOperation;
    } catch (error) {
      // Log error and create failed operation record
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error("Refund operation failed:", error);

      // Create financial operation record with failed status
      await this.disputeDAL.createFinancialOperation({
        disputeId: dispute.id,
        operationType: operation.type,
        amount:
          operation.type === "refund_partial" && operation.amount
            ? operation.amount.toString()
            : undefined,
        status: "failed",
        errorMessage: errorMessage,
        performedBy,
      });

      throw error; // Re-throw to prevent state transition
    }
  }

  /**
   * Hold payout operation
   * This is a business logic operation - no Stripe API call needed
   * The hold is enforced by preventing future payouts (handled in business logic)
   * Creates a financial operation record for audit purposes
   *
   * @param dispute - The dispute record with rental relation
   * @param performedBy - The user ID who is performing the operation
   * @returns The created financial operation record with succeeded status
   */
  private static async holdPayout(
    dispute: DisputeWithRelations,
    performedBy: string,
  ): Promise<FinancialOperationRecord> {
    try {
      // Get payment record to get payment intent ID for reference
      const payment = await this.paymentDAL.getByRentalId(dispute.rentalId);

      // Create financial operation record with succeeded status
      // Note: Actual hold is enforced by business logic preventing future payouts
      const financialOperation = await this.disputeDAL.createFinancialOperation(
        {
          disputeId: dispute.id,
          operationType: "hold_payout",
          stripePaymentIntentId: payment?.stripePaymentIntentId || undefined,
          status: "succeeded",
          performedBy,
        },
      );

      return financialOperation;
    } catch (error) {
      console.error("Hold payout operation failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Create failed operation record
      await this.disputeDAL.createFinancialOperation({
        disputeId: dispute.id,
        operationType: "hold_payout",
        status: "failed",
        errorMessage: errorMessage,
        performedBy,
      });

      throw error;
    }
  }

  /**
   * Capture security deposit (full or partial) with idempotency and lifecycle updates.
   *
   * Checks `depositHoldStatus` before calling Stripe — if not `'held'`, the capture
   * is skipped and recorded as failed with the reason.
   *
   * Uses idempotency key `deposit-capture-{disputeId}` to prevent duplicate captures.
   *
   * @param dispute - The dispute record with rental relation
   * @param performedBy - The user ID performing the operation
   * @param amountToCaptureDollars - Optional amount in dollars for partial captures
   * @returns The created financial operation record
   * @throws {Error} If deposit auth not found or Stripe capture fails
   */
  private static async captureDeposit(
    dispute: DisputeWithRelations,
    performedBy: string,
    amountToCaptureDollars?: number,
  ): Promise<FinancialOperationRecord> {
    try {
      const lifecycle = await this.paymentLifecycleDAL.getByRentalId(
        dispute.rentalId,
      );

      if (lifecycle && lifecycle.depositHoldStatus !== "held") {
        const financialOperation =
          await this.disputeDAL.createFinancialOperation({
            disputeId: dispute.id,
            operationType: "capture_deposit",
            status: "failed",
            errorMessage: `Deposit hold status is '${lifecycle.depositHoldStatus}' — capture skipped`,
            performedBy,
          });
        return financialOperation;
      }

      const securityDepositAuthId =
        await this.rentalDAL.getSecurityDepositAuthId(dispute.rentalId);

      if (!securityDepositAuthId) {
        throw new Error("Security deposit authorization not found for rental");
      }

      const captureParams =
        amountToCaptureDollars != null
          ? { amount_to_capture: Math.round(amountToCaptureDollars * 100) }
          : {};

      const paymentIntent =
        await PAYMENT_SERVER_INSTANCE.paymentIntents.capture(
          securityDepositAuthId,
          captureParams,
          { idempotencyKey: `deposit-capture-${dispute.id}` },
        );

      await this.paymentLifecycleDAL.markDepositCaptured(dispute.rentalId);

      const financialOperation = await this.disputeDAL.createFinancialOperation(
        {
          disputeId: dispute.id,
          operationType: "capture_deposit",
          amount: amountToCaptureDollars?.toString(),
          stripeOperationId: paymentIntent.id,
          stripePaymentIntentId: paymentIntent.id,
          status: "succeeded",
          performedBy,
        },
      );

      return financialOperation;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error("Capture deposit operation failed:", error);

      await this.disputeDAL.createFinancialOperation({
        disputeId: dispute.id,
        operationType: "capture_deposit",
        amount: amountToCaptureDollars?.toString(),
        status: "failed",
        errorMessage,
        performedBy,
      });

      throw error;
    }
  }

  /**
   * Release (cancel) a security deposit hold.
   *
   * Checks `depositHoldStatus` before calling Stripe — if not `'held'`, the release
   * is skipped and recorded as failed with the reason.
   *
   * Updates lifecycle to `released` with `depositReleasedAt` on success.
   *
   * @param dispute - The dispute record with rental relation
   * @param performedBy - The user ID performing the operation
   * @returns The created financial operation record
   * @throws {Error} If deposit auth not found or Stripe cancel fails
   */
  static async releaseDeposit(
    dispute: DisputeWithRelations,
    performedBy: string,
  ): Promise<FinancialOperationRecord> {
    try {
      const lifecycle = await this.paymentLifecycleDAL.getByRentalId(
        dispute.rentalId,
      );

      if (lifecycle && lifecycle.depositHoldStatus !== "held") {
        const financialOperation =
          await this.disputeDAL.createFinancialOperation({
            disputeId: dispute.id,
            operationType: "capture_deposit",
            status: "failed",
            errorMessage: `Deposit hold status is '${lifecycle.depositHoldStatus}' — release skipped`,
            performedBy,
          });
        return financialOperation;
      }

      const securityDepositAuthId =
        await this.rentalDAL.getSecurityDepositAuthId(dispute.rentalId);

      if (!securityDepositAuthId) {
        throw new Error("Security deposit authorization not found for rental");
      }

      const paymentIntent = await PAYMENT_SERVER_INSTANCE.paymentIntents.cancel(
        securityDepositAuthId,
      );

      await this.paymentLifecycleDAL.updateDepositHoldStatus(
        dispute.rentalId,
        "released",
        { depositReleasedAt: new Date() },
      );

      const financialOperation = await this.disputeDAL.createFinancialOperation(
        {
          disputeId: dispute.id,
          operationType: "capture_deposit",
          stripeOperationId: paymentIntent.id,
          stripePaymentIntentId: paymentIntent.id,
          status: "succeeded",
          performedBy,
        },
      );

      return financialOperation;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      console.error("Release deposit operation failed:", error);

      await this.disputeDAL.createFinancialOperation({
        disputeId: dispute.id,
        operationType: "capture_deposit",
        status: "failed",
        errorMessage,
        performedBy,
      });

      throw error;
    }
  }
}
