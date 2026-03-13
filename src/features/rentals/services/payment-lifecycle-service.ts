import { tryCatch } from "@walkup/walkup-utils";
import { paymentLifecycleDAL } from "@/dal";
import {
  releaseDepositHold,
  placeDepositHold,
} from "@/services/stripe/deposit-hold";
import { createOwnerTransfer } from "@/services/stripe/payout";
import { PLATFORM_FEE_PERCENTAGE } from "@/constants/payments";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
import { captureNonCriticalError } from "@/lib/api/route-helpers";
import { getLogger } from "@/lib/logger";

export interface BatchResult {
  processedCount: number;
  successCount: number;
  failureCount: number;
}

export interface DepositExpiryResult {
  checkedCount: number;
  expiredCount: number;
}

/**
 * Service for payment lifecycle operations triggered by cron jobs.
 * Handles payout processing, deposit hold scheduling, and deposit expiry monitoring.
 */
export class PaymentLifecycleService {
  /**
   * Process payouts for completed rentals.
   * For each eligible rental: release deposit hold (if held), then create owner transfer.
   */
  static async processPayouts(batchSize: number = 20): Promise<BatchResult> {
    const eligible = await paymentLifecycleDAL.findEligibleForPayout(batchSize);

    getLogger().info(
      { message: "cron.process_payouts.start", eligible: eligible.length },
      `Found ${eligible.length} rentals eligible for payout`,
    );

    if (eligible.length === 0) {
      return { processedCount: 0, successCount: 0, failureCount: 0 };
    }

    let successCount = 0;
    let failureCount = 0;

    for (const rental of eligible) {
      // Atomically claim for processing (concurrency lock)
      const claimed = await paymentLifecycleDAL.claimForProcessing(
        rental.rentalId,
      );
      if (!claimed) {
        getLogger().info(
          { rentalId: rental.rentalId },
          "Rental already claimed by another process — skipping",
        );
        continue;
      }

      try {
        // Step 1: Release deposit hold if held
        if (rental.lifecycle.depositHoldStatus === "held") {
          const depositAuthId = rental.securityDepositAuthId;
          if (depositAuthId) {
            const { error: releaseError } = await tryCatch(
              releaseDepositHold(depositAuthId),
            );
            if (releaseError) {
              await paymentLifecycleDAL.updateDepositHoldStatus(
                rental.rentalId,
                "release_failed",
              );
              await paymentLifecycleDAL.updatePayoutStatus(
                rental.rentalId,
                "failed",
              );
              await sendOpsAlert({
                event: "deposit_release_failed",
                rentalId: rental.rentalId,
                message: `Deposit hold release failed: ${releaseError.message}`,
                sendEmailAlert: true,
              });
              failureCount++;
              continue;
            }
            await paymentLifecycleDAL.updateDepositHoldStatus(
              rental.rentalId,
              "released",
              { depositReleasedAt: new Date() },
            );
          }
        }

        // Step 2: Create owner transfer if pending
        if (rental.lifecycle.ownerTransferStatus === "pending") {
          if (!rental.ownerConnectedAccountId) {
            await paymentLifecycleDAL.updateOwnerTransferStatus(
              rental.rentalId,
              "failed",
            );
            await paymentLifecycleDAL.updatePayoutStatus(
              rental.rentalId,
              "failed",
            );
            await sendOpsAlert({
              event: "transfer_failed",
              rentalId: rental.rentalId,
              message: "Owner has no connected account ID",
              sendEmailAlert: true,
            });
            failureCount++;
            continue;
          }

          if (!rental.lifecycle.rentalChargeId) {
            await paymentLifecycleDAL.updateOwnerTransferStatus(
              rental.rentalId,
              "failed",
            );
            await paymentLifecycleDAL.updatePayoutStatus(
              rental.rentalId,
              "failed",
            );
            await sendOpsAlert({
              event: "transfer_failed",
              rentalId: rental.rentalId,
              message:
                "Missing rental charge ID (source_transaction) — cannot create transfer",
              sendEmailAlert: true,
            });
            failureCount++;
            continue;
          }

          const transferResult = await createOwnerTransfer({
            rentalId: rental.rentalId,
            rentalRequestId: rental.rentalRequestId,
            ownerId: rental.ownerId,
            ownerConnectedAccountId: rental.ownerConnectedAccountId,
            rentalChargeId: rental.lifecycle.rentalChargeId,
            totalAmount: Number(rental.totalAmount),
            platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
          });

          if (!transferResult.success) {
            await paymentLifecycleDAL.updateOwnerTransferStatus(
              rental.rentalId,
              "failed",
            );
            await paymentLifecycleDAL.updatePayoutStatus(
              rental.rentalId,
              "failed",
            );
            await sendOpsAlert({
              event: "transfer_failed",
              rentalId: rental.rentalId,
              message: `Owner transfer failed: ${transferResult.error}`,
              metadata: { ownerId: rental.ownerId },
              sendEmailAlert: true,
            });
            failureCount++;
            continue;
          }

          await paymentLifecycleDAL.updateOwnerTransferStatus(
            rental.rentalId,
            "completed",
            {
              stripeTransferId: transferResult.transferId,
              ownerTransferredAt: new Date(),
            },
          );
        }

        // Both operations succeeded
        await paymentLifecycleDAL.updatePayoutStatus(
          rental.rentalId,
          "completed",
        );
        successCount++;
      } catch (error) {
        // Unexpected error — mark as failed
        await paymentLifecycleDAL.updatePayoutStatus(rental.rentalId, "failed");
        await sendOpsAlert({
          event: "payout_processing_error",
          rentalId: rental.rentalId,
          message: `Unexpected payout error: ${error instanceof Error ? error.message : "Unknown"}`,
          sendEmailAlert: true,
        });
        failureCount++;
      }
    }

    getLogger().info(
      {
        message: "cron.process_payouts.complete",
        eligible: eligible.length,
        succeeded: successCount,
        failed: failureCount,
      },
      `Payout processing complete: ${successCount} succeeded, ${failureCount} failed`,
    );

    return {
      processedCount: eligible.length,
      successCount,
      failureCount,
    };
  }

  /**
   * Schedule deposit holds for rentals approaching pickup (within 48 hours).
   * Resolves payment methods and places authorization holds via Stripe.
   */
  static async scheduleDepositHolds(
    batchSize: number = 20,
  ): Promise<BatchResult> {
    const eligible =
      await paymentLifecycleDAL.findScheduledDepositsNearPickup(batchSize);

    getLogger().info(
      {
        message: "cron.schedule_deposit_holds.start",
        eligible: eligible.length,
      },
      `Found ${eligible.length} rentals with scheduled deposits`,
    );

    let successCount = 0;
    let failureCount = 0;

    for (const rental of eligible) {
      if (!rental.renterStripeCustomerId) {
        getLogger().error(
          { rentalId: rental.rentalId },
          "Renter has no Stripe customer ID — skipping deposit hold",
        );
        failureCount++;
        continue;
      }

      // Resolve payment method
      let paymentMethodId = rental.renterPaymentMethodId;
      if (!paymentMethodId) {
        // Try to get the default payment method from Stripe
        const { PAYMENT_SERVER_INSTANCE } =
          await import("@/services/stripe/server");
        const { data: customer } = await tryCatch(
          PAYMENT_SERVER_INSTANCE.customers.retrieve(
            rental.renterStripeCustomerId,
          ),
        );
        if (customer && !("deleted" in customer && customer.deleted)) {
          const defaultPm =
            typeof customer.invoice_settings?.default_payment_method ===
            "string"
              ? customer.invoice_settings.default_payment_method
              : customer.invoice_settings?.default_payment_method?.id;
          if (defaultPm) {
            paymentMethodId = defaultPm;
          } else {
            const { data: methods } = await tryCatch(
              PAYMENT_SERVER_INSTANCE.paymentMethods.list({
                customer: rental.renterStripeCustomerId,
                type: "card",
              }),
            );
            paymentMethodId = methods?.data?.[0]?.id ?? null;
          }
        }
      }

      if (!paymentMethodId) {
        getLogger().error(
          { rentalId: rental.rentalId },
          "No payment method found for renter — marking deposit as failed",
        );
        await paymentLifecycleDAL.updateDepositHoldStatus(
          rental.rentalId,
          "failed",
        );
        failureCount++;
        continue;
      }

      const holdResult = await placeDepositHold({
        rentalId: rental.rentalId,
        customerId: rental.renterStripeCustomerId,
        paymentMethodId,
        amount: Number(rental.securityDeposit),
        metadata: {
          rentalRequestId: rental.rentalRequestId,
          rentalId: rental.rentalId,
          listingId: rental.listingId,
          renterId: rental.renterId,
        },
      });

      if (holdResult.success) {
        // Update lifecycle and rental with the auth ID
        await paymentLifecycleDAL.updateDepositHoldStatus(
          rental.rentalId,
          "held",
          { depositHoldPlacedAt: new Date() },
        );

        // Update the rentals table with the security deposit auth ID
        const { db } = await import("@/db/db");
        const { rentals } = await import("@/db/schemas/rentals.schema");
        const { eq } = await import("drizzle-orm");
        await db
          .update(rentals)
          .set({ securityDepositAuthId: holdResult.paymentIntentId })
          .where(eq(rentals.id, rental.rentalId));

        successCount++;
      } else {
        await paymentLifecycleDAL.updateDepositHoldStatus(
          rental.rentalId,
          "failed",
        );

        // Notify renter and owner once about the failure
        try {
          const { sendNotification } =
            await import("@/features/notifications/utils/send-notification");
          sendNotification({
            userId: rental.renterId,
            type: "payment_failed",
            title: "Security Deposit Hold Failed",
            message:
              "The security deposit hold could not be placed. Please verify or update your payment method.",
            data: { rentalId: rental.rentalId },
            linkUrl: "/dashboard/profile/payments",
            category: "payments",
          }).catch((err) =>
            captureNonCriticalError(err, {
              route: "cron/schedule-deposit-holds",
              action: "notify_renter_deposit_failed",
            }),
          );

          // Also notify owner
          if (rental.ownerId) {
            sendNotification({
              userId: rental.ownerId,
              type: "payment_failed",
              title: "Deposit Hold Not Placed",
              message:
                "The security deposit hold could not be placed for an upcoming rental. The rental is proceeding without deposit protection.",
              data: { rentalId: rental.rentalId },
              category: "payments",
            }).catch((err) =>
              captureNonCriticalError(err, {
                route: "cron/schedule-deposit-holds",
                action: "notify_owner_deposit_failed",
              }),
            );
          }
        } catch (notifyError) {
          captureNonCriticalError(notifyError, {
            route: "cron/schedule-deposit-holds",
            action: "deposit_failure_notifications",
          });
        }

        // Ops escalation
        await sendOpsAlert({
          event: "deposit_hold_failed",
          rentalId: rental.rentalId,
          message: `Deposit hold placement failed: ${holdResult.error}`,
          metadata: { renterId: rental.renterId },
          sendEmailAlert: true,
        });

        failureCount++;
      }
    }

    getLogger().info(
      {
        message: "cron.schedule_deposit_holds.complete",
        eligible: eligible.length,
        succeeded: successCount,
        failed: failureCount,
      },
      `Deposit scheduling complete: ${successCount} succeeded, ${failureCount} failed`,
    );

    return {
      processedCount: eligible.length,
      successCount,
      failureCount,
    };
  }

  /**
   * Monitor deposit holds approaching expiry.
   * Checks Stripe PaymentIntent status and marks expired deposits.
   */
  static async monitorDepositExpiry(
    daysThreshold: number = 6,
  ): Promise<DepositExpiryResult> {
    const atRiskDeposits =
      await paymentLifecycleDAL.findExpiringDeposits(daysThreshold);

    getLogger().info(
      {
        message: "cron.monitor_deposit_expiry.start",
        checked: atRiskDeposits.length,
      },
      `Found ${atRiskDeposits.length} deposits approaching expiry`,
    );

    let expiredCount = 0;

    for (const deposit of atRiskDeposits) {
      if (!deposit.securityDepositAuthId) {
        continue;
      }

      // Check actual status from Stripe
      const { PAYMENT_SERVER_INSTANCE } =
        await import("@/services/stripe/server");
      const { data: pi, error: retrieveError } = await tryCatch(
        PAYMENT_SERVER_INSTANCE.paymentIntents.retrieve(
          deposit.securityDepositAuthId,
        ),
      );

      if (retrieveError) {
        getLogger().error(
          {
            rentalId: deposit.rentalId,
            depositAuthId: deposit.securityDepositAuthId,
          },
          `Failed to retrieve deposit PaymentIntent: ${retrieveError.message}`,
        );
        continue;
      }

      // If Stripe shows 'canceled', the hold has expired
      if (pi?.status === "canceled") {
        await paymentLifecycleDAL.updateDepositHoldStatus(
          deposit.rentalId,
          "expired",
        );

        await sendOpsAlert({
          event: "deposit_hold_expired",
          rentalId: deposit.rentalId,
          message: `Security deposit hold expired (PaymentIntent ${deposit.securityDepositAuthId} is canceled by Stripe)`,
          metadata: {
            depositAuthId: deposit.securityDepositAuthId,
            depositHoldPlacedAt:
              deposit.lifecycle.depositHoldPlacedAt?.toISOString(),
          },
          sendEmailAlert: true,
        });

        expiredCount++;
      }
    }

    getLogger().info(
      {
        message: "cron.monitor_deposit_expiry.complete",
        checked: atRiskDeposits.length,
        expired: expiredCount,
      },
      `Deposit expiry monitoring complete: ${expiredCount} expired`,
    );

    return {
      checkedCount: atRiskDeposits.length,
      expiredCount,
    };
  }
}
