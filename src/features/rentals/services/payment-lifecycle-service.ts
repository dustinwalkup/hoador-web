import { tryCatch } from "@walkup/walkup-utils";
import { paymentLifecycleDAL, rentalDAL } from "@/dal";
import {
  releaseDepositHold,
  placeDepositHold,
} from "@/services/stripe/deposit-hold";
import { createOwnerTransfer } from "@/services/stripe/payout";
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
        // Only a transfer that is due (`pending`) or already done (`completed`)
        // can end in a completed payout. `frozen` means a dispute still owns
        // this money (a state-route "resolve" used to leave it that way), and
        // `processing`/`failed` need a human. Checked BEFORE the deposit
        // release so a frozen dispute's deposit is not let go either (BIZ-05).
        const transferStatus = rental.lifecycle.ownerTransferStatus;
        if (transferStatus !== "pending" && transferStatus !== "completed") {
          await paymentLifecycleDAL.updatePayoutStatus(
            rental.rentalId,
            "failed",
          );
          await sendOpsAlert({
            event: "payout_skipped_transfer_not_pending",
            rentalId: rental.rentalId,
            message: `ownerTransferStatus is '${transferStatus}', not 'pending' — refusing to mark payout completed`,
            sendEmailAlert: true,
          });
          failureCount++;
          continue;
        }

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
            ownerPayoutAmount: Number(rental.ownerPayout),
            retryCount: rental.lifecycle.ownerTransferRetryCount,
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

        // Both operations succeeded: the transfer was sent just now, or had
        // already completed before this run.
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
      // Claim before any write (CONC-10). The eligible list is a snapshot:
      // the renter may have cancelled since, or an overlapping run taken the
      // row. Every write below is conditional on the claim still being ours.
      const claimed = await paymentLifecycleDAL.claimForDepositHold(
        rental.rentalId,
      );
      if (!claimed) {
        getLogger().info(
          { rentalId: rental.rentalId },
          "Deposit hold no longer scheduled — skipping (CONC-10)",
        );
        continue;
      }

      if (!rental.renterStripeCustomerId) {
        getLogger().error(
          { rentalId: rental.rentalId },
          "Renter has no Stripe customer ID — skipping deposit hold",
        );
        // Hand the row back so the next run sees it, as before the claim.
        await paymentLifecycleDAL.updateDepositHoldStatus(
          rental.rentalId,
          "scheduled",
          { fromStatus: "placing" },
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
          { fromStatus: "placing" },
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
        const kept = await PaymentLifecycleService.finalizePlacedHold(
          rental.rentalId,
          holdResult.paymentIntentId,
        );
        if (kept) successCount++;
        else failureCount++;
      } else {
        const stillOurs = await paymentLifecycleDAL.updateDepositHoldStatus(
          rental.rentalId,
          "failed",
          { fromStatus: "placing" },
        );
        // A cancel took the row mid-flight: there is no hold, and nobody to
        // tell about one.
        if (!stillOurs) {
          failureCount++;
          continue;
        }

        // The cron only sees `scheduled` rows, so this is always the first
        // failure: tell both parties once. Re-attempts are the renter's retry.
        try {
          const { sendNotification } =
            await import("@/features/notifications/utils/send-notification");

          await sendNotification({
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

          if (rental.ownerId) {
            await sendNotification({
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

  /**
   * Record a hold that was just placed from a `placing` claim (CONC-10).
   *
   * The auth id goes on the rental first, so any reader that sees `held` can
   * always find the hold to release. Then `placing → held` as a
   * compare-and-swap. If that loses, a cancel took the row while Stripe was
   * placing the hold. Nothing else will ever release it, so release it here
   * and tell ops.
   *
   * @returns true when the hold stands, false when it was released.
   */
  private static async finalizePlacedHold(
    rentalId: string,
    paymentIntentId: string,
  ): Promise<boolean> {
    const { db } = await import("@/db/db");
    const { rentals } = await import("@/db/schemas/rentals.schema");
    const { eq } = await import("drizzle-orm");
    await db
      .update(rentals)
      .set({ securityDepositAuthId: paymentIntentId })
      .where(eq(rentals.id, rentalId));

    const held = await paymentLifecycleDAL.updateDepositHoldStatus(
      rentalId,
      "held",
      { depositHoldPlacedAt: new Date(), fromStatus: "placing" },
    );
    if (held) return true;

    const { error: releaseError } = await tryCatch(
      releaseDepositHold(paymentIntentId),
    );
    await sendOpsAlert({
      event: releaseError
        ? "deposit_hold_race_release_failed"
        : "deposit_hold_released_after_race",
      rentalId,
      message: releaseError
        ? `A deposit hold (PaymentIntent ${paymentIntentId}) was placed on a rental that changed state mid-placement (likely cancelled), and releasing it failed — release it manually: ${
            releaseError instanceof Error
              ? releaseError.message
              : String(releaseError)
          }`
        : `A deposit hold (PaymentIntent ${paymentIntentId}) was placed on a rental that changed state mid-placement (likely cancelled); it was released.`,
      sendEmailAlert: Boolean(releaseError),
    });
    return false;
  }

  /**
   * Retry a failed deposit hold for a rental.
   * Called by the renter after updating their payment method.
   */
  static async retryDepositHold(
    rentalRequestId: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { data: rentalRequest, error: requestError } = await tryCatch(
      rentalDAL.getRentalRequestById(rentalRequestId),
    );
    if (requestError || !rentalRequest) {
      return { success: false, error: "Rental not found" };
    }
    if (rentalRequest.renterId !== userId) {
      return { success: false, error: "Not authorized" };
    }

    const rental = await rentalDAL.getRentalByRequestId(rentalRequestId);
    if (!rental) {
      return { success: false, error: "Rental not found" };
    }

    const lifecycle = await paymentLifecycleDAL.getByRentalId(rental.id);
    if (!lifecycle || lifecycle.depositHoldStatus !== "failed") {
      return { success: false, error: "Deposit hold is not in a failed state" };
    }

    if (new Date(rentalRequest.startDate) <= new Date()) {
      return { success: false, error: "Rental has already started" };
    }

    const { user: userSchema } = await import("@/db/schemas/user.schema");
    const { eq } = await import("drizzle-orm");
    const { db } = await import("@/db/db");
    const [renterRecord] = await db
      .select({ stripeCustomerId: userSchema.stripeCustomerId })
      .from(userSchema)
      .where(eq(userSchema.id, userId))
      .limit(1);

    if (!renterRecord?.stripeCustomerId) {
      return { success: false, error: "No payment account found" };
    }

    // Use the renter's current default card, never the stored one: the stored
    // card is the one whose hold just failed, and the renter is told to update
    // their card before retrying.
    let paymentMethodId: string | null = null;
    const { PAYMENT_SERVER_INSTANCE } =
      await import("@/services/stripe/server");
    const { data: customer } = await tryCatch(
      PAYMENT_SERVER_INSTANCE.customers.retrieve(renterRecord.stripeCustomerId),
    );
    if (customer && !("deleted" in customer && customer.deleted)) {
      const defaultPm =
        typeof customer.invoice_settings?.default_payment_method === "string"
          ? customer.invoice_settings.default_payment_method
          : customer.invoice_settings?.default_payment_method?.id;
      if (defaultPm) {
        paymentMethodId = defaultPm;
      } else {
        const { data: methods } = await tryCatch(
          PAYMENT_SERVER_INSTANCE.paymentMethods.list({
            customer: renterRecord.stripeCustomerId,
            type: "card",
          }),
        );
        paymentMethodId = methods?.data?.[0]?.id ?? null;
      }
    }

    if (!paymentMethodId) {
      return {
        success: false,
        error: "No payment method found. Please add a payment method first.",
      };
    }

    // The read above answers the ordinary "not failed" case with a clear
    // message; the claim is what stops a second concurrent retry (e.g. on a
    // different card, so a different idempotency key) or a racing cancel
    // (CONC-10). Taken last, so no early return above strands a `placing` row.
    const claimed = await paymentLifecycleDAL.claimForDepositHold(rental.id);
    if (!claimed) {
      return { success: false, error: "Deposit hold is not in a failed state" };
    }

    const holdResult = await placeDepositHold({
      rentalId: rental.id,
      customerId: renterRecord.stripeCustomerId,
      paymentMethodId,
      amount: Number(rentalRequest.securityDeposit),
      metadata: {
        rentalRequestId: rentalRequest.id,
        rentalId: rental.id,
        listingId: rentalRequest.listingId,
        renterId: rentalRequest.renterId,
      },
      // Card-scoped: a retry on a new card gets a fresh key, while a double
      // tap resolves the same card and key, so Stripe places only one hold.
      idempotencyKey: `deposit-hold-${rental.id}-${paymentMethodId}`,
    });

    if (holdResult.success) {
      const kept = await PaymentLifecycleService.finalizePlacedHold(
        rental.id,
        holdResult.paymentIntentId,
      );
      if (!kept) {
        return {
          success: false,
          error: "This rental changed while the deposit was being placed.",
        };
      }

      // Record the card now holding the deposit. The hold is already placed,
      // so a failure here must not fail the retry.
      if (paymentMethodId !== rentalRequest.paymentMethodId) {
        const { error: pmWriteError } = await tryCatch(
          rentalDAL.updateRentalRequestPaymentMethod(
            rentalRequest.id,
            paymentMethodId,
          ),
        );
        if (pmWriteError) {
          captureNonCriticalError(pmWriteError, {
            route: "PaymentLifecycleService.retryDepositHold",
            action: "record_deposit_payment_method",
          });
        }
      }

      return { success: true };
    }

    // Hand the claim back so the renter can retry again.
    await paymentLifecycleDAL.updateDepositHoldStatus(rental.id, "failed", {
      fromStatus: "placing",
    });
    return {
      success: false,
      error: holdResult.error || "Failed to place deposit hold",
    };
  }
}
