import {
  auditLogDAL,
  legalDocumentDAL,
  listingDAL,
  paymentDAL,
  paymentLifecycleDAL,
  rentalDAL,
  userDAL,
} from "@/dal";
import type { InsertRentalRequestPayload } from "@/dal/rentals.dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { trackActivity } from "@/features/activity/lib/track-activity";
import type { CreateRentalRequestFormData } from "@/features/rentals/lib/form-schema";
import { calculateRentalPricing } from "@/features/rentals/lib/pricing";
import type { RentalPricingListingInput } from "@/features/rentals/lib/pricing";
import {
  sendPaymentFailureNotificationToOwner,
  sendPaymentFailureNotificationToRenter,
} from "@/features/rentals/notifications/payment-failure";
import {
  sendPaymentSucceededNotificationToOwner,
  sendPaymentSucceededNotificationToRenter,
} from "@/features/rentals/notifications/payment-succeeded";
import { sendRentalApprovedNotification } from "@/features/rentals/notifications/rental-approved";
import { sendRentalRequestCreatedNotification } from "@/features/rentals/notifications/rental-request-created";
import { captureNonCriticalError } from "@/lib/api/route-helpers";
import { differenceInDays } from "@/lib/utils/date.utils";
import { sanitizeTextWithMaxLength } from "@/lib/utils/sanitize";
import {
  chargeRentalPayment,
  getPaymentErrorMessage,
  isRetryablePaymentError,
} from "@/services/stripe/rental-payments";
import { placeDepositHold } from "@/services/stripe/deposit-hold";
import { tryCatch } from "@walkup/walkup-utils";

/**
 * Context passed from the API route for audit and legal recording.
 */
export interface CreateRentalRequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

/** Input for approving a rental request (validated body from route). */
export interface ApproveRentalRequestInput {
  pickupInstructions?: string;
  returnInstructions?: string;
}

/** Result of approveRentalRequest: success with payment ids, or failure with message. */
export type ApproveRentalRequestResult =
  | {
      success: true;
      paymentIntentId: string;
      securityDepositAuthId?: string;
      depositHoldStatus?: string;
    }
  | {
      success: false;
      paymentFailed: true;
      error: string;
    }
  | {
      success: false;
      paymentFailed?: false;
      error: string;
    };

/**
 * Resolve payment method for renter: default or first card. Returns null if none.
 */
async function resolveRenterPaymentMethod(
  stripeCustomerId: string,
): Promise<string | null> {
  const { PAYMENT_SERVER_INSTANCE } = await import("@/services/stripe/server");
  const customer =
    await PAYMENT_SERVER_INSTANCE.customers.retrieve(stripeCustomerId);
  if (customer.deleted) return null;
  const defaultPmId =
    typeof customer.invoice_settings?.default_payment_method === "string"
      ? customer.invoice_settings.default_payment_method
      : (customer.invoice_settings?.default_payment_method?.id ?? null);
  const list = await PAYMENT_SERVER_INSTANCE.paymentMethods.list({
    customer: stripeCustomerId,
    type: "card",
  });
  const cardIds = list.data.map((pm) => pm.id);
  if (cardIds.length === 0) return null;
  if (defaultPmId && cardIds.includes(defaultPmId)) return defaultPmId;
  return cardIds[0];
}

/**
 * Rental service: business logic and orchestration for rental operations.
 * Delegates data access to DALs and uses the pricing module for calculations.
 */
export class RentalService {
  /**
   * Create a rental request: validate listing/ownership/period, calculate pricing,
   * persist, then audit, activity, legal acceptances, and notification.
   *
   * @param formData - Validated form data from the request
   * @param userId - Authenticated renter user ID
   * @param context - IP and user agent for audit/legal
   * @returns The created rental request id
   * @throws NotFoundError if listing not found
   * @throws Error for business rule violations (own listing, period limits)
   */
  static async createRentalRequest(
    formData: CreateRentalRequestFormData,
    userId: string,
    context: CreateRentalRequestContext,
  ): Promise<{ id: string }> {
    const listing = await listingDAL.getListingById(formData.listingId);
    if (!listing) {
      const { NotFoundError } = await import("@/dal/errors");
      throw new NotFoundError("Listing", formData.listingId);
    }

    if (listing.owner.id === userId) {
      throw new Error("Cannot rent your own listing");
    }

    const totalDays =
      differenceInDays(formData.endDate, formData.startDate) + 1;
    if (totalDays < listing.minimumRentalPeriod) {
      throw new Error(
        `Minimum rental period is ${listing.minimumRentalPeriod} day(s)`,
      );
    }
    if (totalDays > listing.maximumRentalPeriod) {
      throw new Error(
        `Maximum rental period is ${listing.maximumRentalPeriod} days`,
      );
    }

    const pricingInputListing: RentalPricingListingInput = {
      dailyRate: String(listing.dailyRate),
      weeklyRate:
        listing.weeklyRate != null ? String(listing.weeklyRate) : null,
      monthlyRate:
        listing.monthlyRate != null ? String(listing.monthlyRate) : null,
      deliveryFee: String(listing.deliveryFee),
      setupFee: String(listing.setupFee),
      securityDeposit: String(listing.securityDeposit),
    };

    const pricing = calculateRentalPricing({
      listing: pricingInputListing,
      totalDays,
      deliveryRequested: formData.deliveryRequested,
      setupRequested: formData.setupRequested,
      setupFee: formData.setupFee,
    });

    const sanitizedMessage = formData.message
      ? sanitizeTextWithMaxLength(formData.message, 2000)
      : null;
    const sanitizedDeliveryInstructions = formData.deliveryInstructions
      ? sanitizeTextWithMaxLength(formData.deliveryInstructions, 2000)
      : null;

    const payload: InsertRentalRequestPayload = {
      listingId: formData.listingId,
      renterId: userId,
      ownerId: listing.owner.id,
      startDate: formData.startDate,
      endDate: formData.endDate,
      totalDays,
      dailyRate: pricing.dailyRate.toString(),
      totalAmount: pricing.totalAmount.toString(),
      securityDeposit: pricing.securityDeposit.toString(),
      deliveryRequested: formData.deliveryRequested,
      deliveryAddress: formData.deliveryAddress ?? null,
      deliveryInstructions: sanitizedDeliveryInstructions,
      deliveryFee: pricing.deliveryFee.toString(),
      setupRequested: formData.setupRequested ?? false,
      setupFee: pricing.setupFee.toString(),
      serviceFee: pricing.serviceFee.toString(),
      applicationFeeAmount: pricing.applicationFeeAmount.toString(),
      ownerPayout: pricing.ownerPayout.toString(),
      platformNetRevenue: pricing.platformNetRevenue.toString(),
      message: sanitizedMessage,
      paymentIntentId: formData.paymentIntentId ?? null,
      paymentMethodId: formData.paymentMethodId ?? null,
      status: "pending",
    };

    const { id } = await rentalDAL.insertRentalRequest(payload);

    await auditLogDAL.create({
      entityType: "rental_request",
      entityId: id,
      action: "rental_request.created",
      userId,
      metadata: {
        listingId: formData.listingId,
        startDate:
          formData.startDate instanceof Date
            ? formData.startDate.toISOString()
            : String(formData.startDate),
        endDate:
          formData.endDate instanceof Date
            ? formData.endDate.toISOString()
            : String(formData.endDate),
      },
      ipAddress: context.ipAddress ?? undefined,
      userAgent: context.userAgent ?? undefined,
    });

    trackActivity(userId, "rental_requested", {
      rentalRequestId: id,
      listingId: formData.listingId,
    });

    if (
      formData.rentalAgreementAccepted ||
      formData.cancellationRefundAcknowledged ||
      formData.safetyLiabilityPackageAccepted ||
      formData.paymentPayoutAccepted
    ) {
      try {
        const documentVersions = await legalDocumentDAL.getAllCurrentVersions();
        const acceptancePromises = [];

        if (
          formData.rentalAgreementAccepted &&
          documentVersions[LEGAL_DOCUMENT_IDS.PER_RENTAL_AGREEMENT]
        ) {
          const doc = documentVersions[LEGAL_DOCUMENT_IDS.PER_RENTAL_AGREEMENT];
          acceptancePromises.push(
            legalDocumentDAL.recordAcceptance(
              userId,
              LEGAL_DOCUMENT_IDS.PER_RENTAL_AGREEMENT,
              doc.version,
              context.ipAddress,
              context.userAgent,
              "rental_checkout",
              id,
            ),
          );
        }
        if (
          formData.cancellationRefundAcknowledged &&
          documentVersions[LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND]
        ) {
          const doc = documentVersions[LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND];
          acceptancePromises.push(
            legalDocumentDAL.recordAcceptance(
              userId,
              LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND,
              doc.version,
              context.ipAddress,
              context.userAgent,
              "rental_checkout",
              id,
            ),
          );
        }
        if (
          formData.safetyLiabilityPackageAccepted &&
          documentVersions[LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE]
        ) {
          const doc =
            documentVersions[LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE];
          acceptancePromises.push(
            legalDocumentDAL.recordAcceptance(
              userId,
              LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE,
              doc.version,
              context.ipAddress,
              context.userAgent,
              "rental_checkout",
              id,
            ),
          );
        }
        if (
          formData.paymentPayoutAccepted &&
          documentVersions[LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS]
        ) {
          const doc = documentVersions[LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS];
          acceptancePromises.push(
            legalDocumentDAL.recordAcceptance(
              userId,
              LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS,
              doc.version,
              context.ipAddress,
              context.userAgent,
              "rental_checkout",
              id,
            ),
          );
        }
        await Promise.allSettled(acceptancePromises);
      } catch (error) {
        captureNonCriticalError(error, {
          route: "RentalService.createRentalRequest",
          action: "record_legal_acceptances",
        });
      }
    }

    try {
      const fullRequest = await rentalDAL.getRentalRequestById(id, userId);
      if (fullRequest) {
        const [ownerUser, renterUser] = await Promise.all([
          userDAL.getUserById(fullRequest.ownerId),
          userDAL.getUserById(fullRequest.renterId),
        ]);
        if (ownerUser && renterUser) {
          const startDate = new Date(
            fullRequest.startDate,
          ).toLocaleDateString();
          const endDate = new Date(fullRequest.endDate).toLocaleDateString();
          sendRentalRequestCreatedNotification({
            userId: ownerUser.id,
            to: ownerUser.email,
            ownerName: `${ownerUser.firstName} ${ownerUser.lastName}`,
            renterName: `${renterUser.firstName} ${renterUser.lastName}`,
            listingName: fullRequest.listingName,
            rentalId: fullRequest.id,
            startDate,
            endDate,
            totalAmount: fullRequest.totalAmount,
          }).catch((err) => {
            captureNonCriticalError(err, {
              route: "RentalService.createRentalRequest",
              action: "send_rental_request_notification",
            });
          });
        }
      }
    } catch (notificationError) {
      captureNonCriticalError(notificationError, {
        route: "RentalService.createRentalRequest",
        action: "send_owner_notification",
      });
    }

    return { id };
  }

  /**
   * Approve a rental request: resolve payment method, charge renter, authorize deposit,
   * approve in DAL, create payment record, send notifications, trigger PDF generation.
   */
  static async approveRentalRequest(
    rentalId: string,
    userId: string,
    input: ApproveRentalRequestInput,
    context: CreateRentalRequestContext,
  ): Promise<ApproveRentalRequestResult> {
    const { data: rentalRequest, error: fetchError } = await tryCatch(
      rentalDAL.getRentalRequestById(rentalId, userId),
    );
    if (fetchError || !rentalRequest) {
      const { NotFoundError } = await import("@/dal/errors");
      throw new NotFoundError("Rental request", rentalId);
    }
    if (rentalRequest.ownerId !== userId) {
      throw new Error(
        "Forbidden: Only the listing owner can approve rental requests",
      );
    }

    const { data: stripeCustomerId, error: customerError } = await tryCatch(
      userDAL.getOrCreateStripeCustomerId(rentalRequest.renterId),
    );
    if (customerError || !stripeCustomerId) {
      throw new Error(
        customerError?.message || "Failed to get renter's payment info",
      );
    }

    // On retry after payment failure, re-fetch the renter's current default
    // payment method instead of reusing the stored (failed) one.
    const isRetryAfterFailure = rentalRequest.paymentStatus === "failed";
    let paymentMethodIdToUse: string | null = isRetryAfterFailure
      ? null
      : rentalRequest.paymentMethodId;
    if (!paymentMethodIdToUse) {
      const { data: defaultOrFirstPm } = await tryCatch(
        resolveRenterPaymentMethod(stripeCustomerId),
      );
      paymentMethodIdToUse = defaultOrFirstPm ?? null;
    }
    if (!paymentMethodIdToUse) {
      throw new Error(
        "No payment method on file for renter. The renter needs to add a payment method in their account before you can approve.",
      );
    }

    if (
      (!rentalRequest.paymentMethodId || isRetryAfterFailure) &&
      paymentMethodIdToUse
    ) {
      await rentalDAL.updateRentalRequestPaymentMethod(
        rentalId,
        paymentMethodIdToUse,
      );
    }

    // Verify owner's Stripe Connect is set up (needed for later payout)
    const { data: ownerAccountId, error: accountError } = await tryCatch(
      userDAL.getConnectedAccountId(rentalRequest.ownerId),
    );
    if (accountError || !ownerAccountId) {
      throw new Error(
        "Owner must complete Stripe onboarding before receiving payments. Please contact the owner.",
      );
    }

    const { data: isOnboarded, error: onboardingCheckError } = await tryCatch(
      userDAL.isConnectOnboardingComplete(rentalRequest.ownerId),
    );
    if (onboardingCheckError || !isOnboarded) {
      throw new Error(
        "Owner's Stripe account is not fully set up. Please contact the owner to complete onboarding.",
      );
    }

    const totalAmount = Number(rentalRequest.totalAmount);
    const applicationFeeAmount = Number(rentalRequest.applicationFeeAmount);

    await rentalDAL.updateRentalRequestPaymentStatus(rentalId, {
      paymentStatus: "processing",
    });

    const chargePayload = {
      rentalRequestId: rentalRequest.id,
      listingId: rentalRequest.listingId,
      ownerId: rentalRequest.ownerId,
      renterId: rentalRequest.renterId,
      listingName: rentalRequest.listingName,
    };

    // On retry after failure, use a new idempotency key since the payment
    // method may have changed. Append timestamp to make it unique.
    const idempotencyKey = isRetryAfterFailure
      ? `rental-charge-${rentalRequest.id}-retry-${Date.now()}`
      : `rental-charge-${rentalRequest.id}`;

    let rentalPaymentAttempts = 0;
    let rentalPaymentResult = await tryCatch(
      chargeRentalPayment(
        stripeCustomerId,
        paymentMethodIdToUse,
        totalAmount,
        chargePayload,
        idempotencyKey,
      ),
    );

    if (
      rentalPaymentResult.error &&
      isRetryablePaymentError(rentalPaymentResult.error) &&
      rentalPaymentAttempts === 0
    ) {
      rentalPaymentAttempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      rentalPaymentResult = await tryCatch(
        chargeRentalPayment(
          stripeCustomerId,
          paymentMethodIdToUse,
          totalAmount,
          chargePayload,
          idempotencyKey,
        ),
      );
    }

    if (rentalPaymentResult.error || !rentalPaymentResult.data) {
      const errorMessage = getPaymentErrorMessage(rentalPaymentResult.error);
      await rentalDAL.updateRentalRequestPaymentStatus(rentalId, {
        paymentStatus: "failed",
        paymentFailureReason: errorMessage,
      });
      await auditLogDAL.create({
        entityType: "payment",
        entityId: rentalId,
        action: "payment.failed",
        userId,
        metadata: {
          amount: totalAmount,
          currency: "usd",
          status: "failed",
          errorMessage,
        },
        ipAddress: context.ipAddress ?? undefined,
        userAgent: context.userAgent ?? undefined,
      });
      const [renterUser, ownerUser] = await Promise.all([
        userDAL.getUserById(rentalRequest.renterId),
        userDAL.getUserById(rentalRequest.ownerId),
      ]);
      if (renterUser && ownerUser) {
        sendPaymentFailureNotificationToRenter({
          userId: renterUser.id,
          to: renterUser.email,
          renterName: `${renterUser.firstName} ${renterUser.lastName}`,
          ownerName: `${ownerUser.firstName} ${ownerUser.lastName}`,
          listingName: rentalRequest.listingName,
          totalAmount: rentalRequest.totalAmount,
          failureReason: errorMessage,
          rentalId: rentalRequest.id,
        }).catch((err) => {
          captureNonCriticalError(err, {
            route: "RentalService.approveRentalRequest",
            action: "send_payment_failure_renter",
          });
        });
        sendPaymentFailureNotificationToOwner({
          userId: ownerUser.id,
          to: ownerUser.email,
          ownerName: `${ownerUser.firstName} ${ownerUser.lastName}`,
          renterName: `${renterUser.firstName} ${renterUser.lastName}`,
          listingName: rentalRequest.listingName,
          totalAmount: rentalRequest.totalAmount,
          failureReason: errorMessage,
          rentalId: rentalRequest.id,
        }).catch((err) => {
          captureNonCriticalError(err, {
            route: "RentalService.approveRentalRequest",
            action: "send_payment_failure_owner",
          });
        });
      }
      return { success: false, paymentFailed: true, error: errorMessage };
    }

    const rentalPaymentIntent = rentalPaymentResult.data;
    if (rentalPaymentIntent.status !== "succeeded") {
      const errorMessage = `Payment status: ${rentalPaymentIntent.status}`;
      await rentalDAL.updateRentalRequestPaymentStatus(rentalId, {
        paymentStatus: "failed",
        paymentFailureReason: errorMessage,
      });
      await auditLogDAL.create({
        entityType: "payment",
        entityId: rentalPaymentIntent.id,
        action: "payment.failed",
        userId,
        metadata: {
          amount: totalAmount,
          currency: "usd",
          status: rentalPaymentIntent.status,
        },
        ipAddress: context.ipAddress ?? undefined,
        userAgent: context.userAgent ?? undefined,
      });
      return {
        success: false,
        paymentFailed: true,
        error: errorMessage,
      };
    }

    await auditLogDAL.create({
      entityType: "payment",
      entityId: rentalPaymentIntent.id,
      action: "payment.captured",
      userId,
      metadata: {
        amount: totalAmount,
        currency: "usd",
        status: "succeeded",
      },
      ipAddress: context.ipAddress ?? undefined,
      userAgent: context.userAgent ?? undefined,
    });

    // Extract Charge ID for later use as source_transaction on owner transfer
    const rentalChargeId =
      typeof rentalPaymentIntent.latest_charge === "string"
        ? rentalPaymentIntent.latest_charge
        : (rentalPaymentIntent.latest_charge?.id ?? null);

    // Determine deposit hold status based on deposit amount and timing
    let securityDepositAuthId: string | undefined;
    let depositHoldStatus: "scheduled" | "held" | "failed" | "not_applicable";
    const securityDepositAmount = Number(rentalRequest.securityDeposit);

    if (securityDepositAmount <= 0) {
      depositHoldStatus = "not_applicable";
    } else {
      const hoursUntilPickup =
        (new Date(rentalRequest.startDate).getTime() - Date.now()) /
        (1000 * 60 * 60);

      if (hoursUntilPickup <= 48) {
        // Place deposit hold immediately
        const holdResult = await placeDepositHold({
          rentalId: rentalRequest.id,
          customerId: stripeCustomerId,
          paymentMethodId: paymentMethodIdToUse,
          amount: securityDepositAmount,
          metadata: {
            rentalRequestId: rentalRequest.id,
            rentalId: rentalRequest.id,
            listingId: rentalRequest.listingId,
            renterId: rentalRequest.renterId,
          },
        });

        if (holdResult.success) {
          securityDepositAuthId = holdResult.paymentIntentId;
          depositHoldStatus = "held";
        } else {
          depositHoldStatus = "failed";
          captureNonCriticalError(
            new Error(`Deposit hold failed: ${holdResult.error}`),
            {
              route: "RentalService.approveRentalRequest",
              action: "place_deposit_hold_immediate",
            },
          );
        }
      } else {
        // Schedule for cron to place 48hrs before pickup
        depositHoldStatus = "scheduled";
      }
    }

    const { error: approvalError } = await tryCatch(
      rentalDAL.approveRentalRequest(rentalId, userId, {
        pickupInstructions: input.pickupInstructions,
        returnInstructions: input.returnInstructions,
        rentalPaymentIntentId: rentalPaymentIntent.id,
        securityDepositAuthId,
        applicationFeeAmount: applicationFeeAmount.toString(),
      }),
    );

    if (approvalError) {
      throw new Error(
        "Payment was processed but approval failed. Please contact support immediately.",
      );
    }

    const createdRental = await rentalDAL.getRentalByRequestId(rentalId);
    if (createdRental) {
      // Create payment record
      const { error: paymentRecordError } = await tryCatch(
        paymentDAL.createPayment({
          rentalId: createdRental.id,
          payerId: rentalRequest.renterId,
          payeeId: rentalRequest.ownerId,
          amount: totalAmount.toString(),
          platformFee: applicationFeeAmount.toString(),
          paymentMethodId: paymentMethodIdToUse || undefined,
          stripePaymentIntentId: rentalPaymentIntent.id,
          status: "succeeded",
          paidAt: new Date(),
          paymentType: "rental_charge",
        }),
      );
      if (!paymentRecordError) {
        trackActivity(rentalRequest.renterId, "payment_made", {
          rentalId: createdRental.id,
          rentalRequestId: rentalRequest.id,
        });
        // Note: payout_received is NOT tracked here — owner payout happens later via cron
      }

      // Create payment lifecycle record
      const { error: lifecycleError } = await tryCatch(
        paymentLifecycleDAL.create({
          rentalId: createdRental.id,
          rentalChargeId,
          depositHoldStatus,
          ownerTransferStatus: "pending",
          payoutStatus: "pending",
        }),
      );
      if (lifecycleError) {
        captureNonCriticalError(lifecycleError, {
          route: "RentalService.approveRentalRequest",
          action: "create_payment_lifecycle",
        });
      }

      // If deposit was held immediately, update the placed timestamp
      if (depositHoldStatus === "held") {
        await tryCatch(
          paymentLifecycleDAL.updateDepositHoldStatus(
            createdRental.id,
            "held",
            { depositHoldPlacedAt: new Date() },
          ),
        );
      }

      // If deposit hold failed, notify both parties with email
      if (depositHoldStatus === "failed") {
        try {
          const [renterUser, ownerUser] = await Promise.all([
            userDAL.getUserById(rentalRequest.renterId),
            userDAL.getUserById(rentalRequest.ownerId),
          ]);
          const {
            sendDepositHoldFailureNotificationToRenter,
            sendDepositHoldFailureNotificationToOwner,
          } =
            await import("@/features/rentals/notifications/deposit-hold-failure");
          if (renterUser) {
            sendDepositHoldFailureNotificationToRenter({
              userId: renterUser.id,
              to: renterUser.email,
              renterName: `${renterUser.firstName} ${renterUser.lastName}`,
              listingName: rentalRequest.listingName,
              rentalId: rentalRequest.id,
              securityDeposit: rentalRequest.securityDeposit,
            }).catch((err) =>
              captureNonCriticalError(err, {
                route: "RentalService.approveRentalRequest",
                action: "notify_renter_deposit_failed",
              }),
            );
          }
          if (ownerUser && renterUser) {
            sendDepositHoldFailureNotificationToOwner({
              userId: ownerUser.id,
              to: ownerUser.email,
              ownerName: `${ownerUser.firstName} ${ownerUser.lastName}`,
              renterName: `${renterUser.firstName} ${renterUser.lastName}`,
              listingName: rentalRequest.listingName,
              rentalId: rentalRequest.id,
              securityDeposit: rentalRequest.securityDeposit,
            }).catch((err) =>
              captureNonCriticalError(err, {
                route: "RentalService.approveRentalRequest",
                action: "notify_owner_deposit_failed",
              }),
            );
          }
        } catch (notifyError) {
          captureNonCriticalError(notifyError, {
            route: "RentalService.approveRentalRequest",
            action: "deposit_failure_notifications",
          });
        }
      }
    }

    try {
      const [renterUser, ownerUser] = await Promise.all([
        userDAL.getUserById(rentalRequest.renterId),
        userDAL.getUserById(rentalRequest.ownerId),
      ]);
      if (renterUser && ownerUser) {
        const startDate = new Date(
          rentalRequest.startDate,
        ).toLocaleDateString();
        const endDate = new Date(rentalRequest.endDate).toLocaleDateString();

        sendPaymentSucceededNotificationToRenter({
          userId: renterUser.id,
          to: renterUser.email,
          renterName: `${renterUser.firstName} ${renterUser.lastName}`,
          ownerName: `${ownerUser.firstName} ${ownerUser.lastName}`,
          listingName: rentalRequest.listingName,
          rentalId: rentalRequest.id,
          totalAmount: rentalRequest.totalAmount,
          securityDeposit: rentalRequest.securityDeposit,
          depositHoldStatus,
        }).catch((err) => {
          captureNonCriticalError(err, {
            route: "RentalService.approveRentalRequest",
            action: "send_payment_success_renter",
          });
        });
        sendPaymentSucceededNotificationToOwner({
          userId: ownerUser.id,
          to: ownerUser.email,
          ownerName: `${ownerUser.firstName} ${ownerUser.lastName}`,
          renterName: `${renterUser.firstName} ${renterUser.lastName}`,
          listingName: rentalRequest.listingName,
          rentalId: rentalRequest.id,
          totalAmount: rentalRequest.totalAmount,
        }).catch((err) => {
          captureNonCriticalError(err, {
            route: "RentalService.approveRentalRequest",
            action: "send_payment_success_owner",
          });
        });

        const approvedCount = await rentalDAL.getApprovedRentalCountForRenter(
          renterUser.id,
        );
        const firstApproval = approvedCount === 1;
        sendRentalApprovedNotification({
          userId: renterUser.id,
          to: renterUser.email,
          renterName: `${renterUser.firstName} ${renterUser.lastName}`,
          ownerName: `${ownerUser.firstName} ${ownerUser.lastName}`,
          listingName: rentalRequest.listingName,
          rentalId: rentalRequest.id,
          startDate,
          endDate,
          totalAmount: rentalRequest.totalAmount,
          firstApproval,
        }).catch((err) => {
          captureNonCriticalError(err, {
            route: "RentalService.approveRentalRequest",
            action: "send_rental_approved_notification",
          });
        });
      }
    } catch (notificationError) {
      captureNonCriticalError(notificationError, {
        route: "RentalService.approveRentalRequest",
        action: "send_success_notifications",
      });
    }

    trackActivity(userId, "rental_approved", {
      rentalId,
      rentalRequestId: rentalRequest.id,
    });

    const internalSecret = process.env.INTERNAL_API_SECRET;
    const baseUrl =
      process.env.VERCEL_URL != null
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL;
    if (internalSecret && baseUrl) {
      fetch(`${baseUrl}/api/internal/generate-rental-agreement`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({ rentalRequestId: rentalRequest.id }),
        signal: AbortSignal.timeout(5000),
      }).catch((err) => {
        captureNonCriticalError(err, {
          route: "RentalService.approveRentalRequest",
          action: "trigger_pdf_generation",
        });
      });
    }

    return {
      success: true,
      paymentIntentId: rentalPaymentIntent.id,
      securityDepositAuthId,
      depositHoldStatus,
    };
  }
}
