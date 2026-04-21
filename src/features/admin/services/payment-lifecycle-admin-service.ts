import Stripe from "stripe";
import { paymentLifecycleDAL, auditLogDAL, rentalDAL } from "@/dal";
import type {
  LifecycleListFilters,
  LifecycleListItem,
  LifecycleDetail,
  PaymentMetrics,
  FinancialMetrics,
} from "@/dal/payment-lifecycle.dal";
import type { PaginatedResult } from "@/dal/types";
import { NotFoundError, ValidationError } from "@/dal/errors";
import { PAYMENT_SERVER_INSTANCE } from "@/services/stripe/server";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
import { sendNotification } from "@/features/notifications/utils/send-notification";

/** Result of an admin override action (reset payout/transfer, release deposit). */
export interface OverrideResult {
  success: boolean;
  error?: string;
}

/**
 * Admin service for payment lifecycle: list/detail/metrics and manual overrides
 * (reset payout status, reset transfer status, release deposit). Phase 4 — Requirements 1–8, 10, 11.
 */
export const PaymentLifecycleAdminService = {
  /** Get paginated lifecycle list with filters. */
  async getLifecycleList(
    filters: LifecycleListFilters,
  ): Promise<PaginatedResult<LifecycleListItem>> {
    return paymentLifecycleDAL.getLifecycleListForAdmin(filters);
  },

  /** Get full lifecycle detail by rentalId; throws NotFoundError if not found. */
  async getLifecycleDetail(rentalId: string): Promise<LifecycleDetail> {
    const detail =
      await paymentLifecycleDAL.getLifecycleDetailForAdmin(rentalId);
    if (!detail) {
      throw new NotFoundError("Payment lifecycle", rentalId);
    }
    return detail;
  },

  /** Get aggregate payment metrics. */
  async getPaymentMetrics(): Promise<PaymentMetrics> {
    return paymentLifecycleDAL.getPaymentMetrics();
  },

  /** Get financial KPIs with time period filtering. */
  async getFinancialMetrics(days: number): Promise<FinancialMetrics> {
    const validDays = [7, 30, 90].includes(days) ? days : 30;
    return paymentLifecycleDAL.getFinancialMetrics(validDays);
  },

  /**
   * Reset payout status from 'processing' or 'failed' to 'pending'. Audit log created.
   * Requirements: 6.1, 6.2, 6.3, 6.5, 10.1, 10.2
   */
  async resetPayoutStatus(
    rentalId: string,
    options: { reason?: string; adminId?: string },
  ): Promise<OverrideResult> {
    const lifecycle = await paymentLifecycleDAL.getByRentalId(rentalId);
    if (!lifecycle) {
      throw new NotFoundError("Payment lifecycle", rentalId);
    }
    if (
      lifecycle.payoutStatus !== "processing" &&
      lifecycle.payoutStatus !== "failed"
    ) {
      throw new ValidationError(
        `Cannot reset payout status when current status is '${lifecycle.payoutStatus}'. Only 'processing' or 'failed' can be reset.`,
        "payoutStatus",
      );
    }

    const previousStatus = lifecycle.payoutStatus;
    await paymentLifecycleDAL.updatePayoutStatus(rentalId, "pending");

    await auditLogDAL.create({
      entityType: "payment_lifecycle",
      entityId: rentalId,
      action: "payout_status_reset",
      userId: options.adminId ?? null,
      metadata: {
        previousStatus,
        newStatus: "pending",
        reason: options.reason ?? null,
      },
    });

    return { success: true };
  },

  /**
   * Reset owner transfer status from 'failed' to 'pending'. If payoutStatus is also 'failed', reset it to 'pending'. Audit log created.
   * Requirements: 7.1, 7.2, 7.3, 7.4, 10.1, 10.2
   */
  async resetTransferStatus(
    rentalId: string,
    options: { reason?: string; adminId?: string },
  ): Promise<OverrideResult> {
    const lifecycle = await paymentLifecycleDAL.getByRentalId(rentalId);
    if (!lifecycle) {
      throw new NotFoundError("Payment lifecycle", rentalId);
    }
    if (lifecycle.ownerTransferStatus !== "failed") {
      throw new ValidationError(
        `Cannot reset transfer status when current status is '${lifecycle.ownerTransferStatus}'. Only 'failed' can be reset.`,
        "ownerTransferStatus",
      );
    }

    const previousTransferStatus = lifecycle.ownerTransferStatus;
    const previousPayoutStatus = lifecycle.payoutStatus;

    await paymentLifecycleDAL.updateOwnerTransferStatus(rentalId, "pending");
    await paymentLifecycleDAL.incrementOwnerTransferRetryCount(rentalId);
    if (lifecycle.payoutStatus === "failed") {
      await paymentLifecycleDAL.updatePayoutStatus(rentalId, "pending");
    }

    await auditLogDAL.create({
      entityType: "payment_lifecycle",
      entityId: rentalId,
      action: "owner_transfer_status_reset",
      userId: options.adminId ?? null,
      metadata: {
        previousTransferStatus,
        previousPayoutStatus,
        retryCount: lifecycle.ownerTransferRetryCount + 1,
        reason: options.reason ?? null,
      },
    });

    return { success: true };
  },

  /**
   * Manually release deposit hold (cancel PaymentIntent). Valid when depositHoldStatus is 'held'.
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 10.1, 11.2
   */
  async releaseDeposit(
    rentalId: string,
    options: { adminId?: string },
  ): Promise<OverrideResult> {
    const lifecycle = await paymentLifecycleDAL.getByRentalId(rentalId);
    if (!lifecycle) {
      throw new NotFoundError("Payment lifecycle", rentalId);
    }
    if (lifecycle.depositHoldStatus !== "held") {
      throw new ValidationError(
        `Cannot release deposit when status is '${lifecycle.depositHoldStatus}'. Only 'held' can be released.`,
        "depositHoldStatus",
      );
    }

    const rentalContext =
      await rentalDAL.getRentalDepositReleaseContext(rentalId);
    if (!rentalContext) {
      throw new NotFoundError(
        "Rental or security deposit authorization",
        rentalId,
      );
    }

    const { securityDepositAuthId, renterId } = rentalContext;

    try {
      await PAYMENT_SERVER_INSTANCE.paymentIntents.cancel(
        securityDepositAuthId,
      );
    } catch (error: unknown) {
      const stripeError = error as Stripe.errors.StripeError;
      const code = stripeError?.code;
      const message =
        typeof stripeError?.message === "string"
          ? stripeError.message
          : String(error);

      if (
        code === "payment_intent_unexpected_state" &&
        message.toLowerCase().includes("canceled")
      ) {
        // Already canceled by Stripe — treat as success
      } else {
        await auditLogDAL.create({
          entityType: "payment_lifecycle",
          entityId: rentalId,
          action: "manual_deposit_release",
          userId: options.adminId ?? null,
          metadata: {
            status: "failed",
            stripeCode: code,
            errorMessage: message,
          },
        });
        await sendOpsAlert({
          event: "manual_deposit_release_failed",
          rentalId,
          message: `Stripe cancel failed: ${message}`,
          metadata: { code, errorMessage: message },
          sendEmailAlert: true,
        });
        return {
          success: false,
          error: message,
        };
      }
    }

    const depositReleasedAt = new Date();
    await paymentLifecycleDAL.updateDepositHoldStatus(rentalId, "released", {
      depositReleasedAt,
    });

    await auditLogDAL.create({
      entityType: "payment_lifecycle",
      entityId: rentalId,
      action: "manual_deposit_release",
      userId: options.adminId ?? null,
      metadata: { status: "succeeded" },
    });

    await sendNotification({
      userId: renterId,
      type: "system",
      title: "Security deposit released",
      message:
        "Your security deposit hold has been released. No charge was made.",
      data: { rentalId },
      linkUrl: `/dashboard/rental/${rentalId}`,
    });

    return { success: true };
  },
};
