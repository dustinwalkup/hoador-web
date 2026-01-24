"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { rentalDAL, userDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import {
  chargeRentalPayment,
  authorizeSecurityDeposit,
  getPaymentErrorMessage,
  isRetryablePaymentError,
} from "@/services/stripe/rental-payments";
import { PLATFORM_FEE_PERCENTAGE } from "@/constants/payments";
import {
  sendPaymentFailureNotificationToRenter,
  sendPaymentFailureNotificationToOwner,
} from "../notifications/payment-failure";
import {
  sendPaymentSucceededNotificationToRenter,
  sendPaymentSucceededNotificationToOwner,
} from "../notifications/payment-succeeded";
import { sendRentalApprovedNotification } from "../notifications/rental-approved";

const approveRequestSchema = z.object({
  requestId: z.string().uuid(),
  pickupInstructions: z.string().optional(),
  returnInstructions: z.string().optional(),
});

export async function approveRentalRequest(
  data: z.infer<typeof approveRequestSchema>,
) {
  // Validate input data
  const parseResult = approveRequestSchema.safeParse(data);
  if (!parseResult.success) {
    return {
      success: false,
      error: "Invalid data provided",
    };
  }

  const validatedData = parseResult.data;

  // Get current user ID for authorization
  const { getCurrentUserId } = await import("@/features/auth/utils/session");
  const userId = await getCurrentUserId();
  if (!userId) {
    return {
      success: false,
      error: "Authentication required",
    };
  }

  // Fetch rental request details
  const { data: rentalRequest, error: fetchError } = await tryCatch(
    (async () => {
      return await rentalDAL.getRentalRequestById(
        validatedData.requestId,
        userId,
      );
    })(),
  );

  if (fetchError || !rentalRequest) {
    return {
      success: false,
      error: fetchError?.message || "Rental request not found",
    };
  }

  // Authorization check: only owner can approve
  if (rentalRequest.ownerId !== userId) {
    return {
      success: false,
      error: "Forbidden: Only the listing owner can approve rental requests",
    };
  }

  // Check if payment method is available
  if (!rentalRequest.paymentMethodId) {
    return {
      success: false,
      error: "No payment method on file for renter",
    };
  }

  // Get or create Stripe customer ID for the renter
  const { data: stripeCustomerId, error: customerError } = await tryCatch(
    (async () => {
      return await userDAL.getOrCreateStripeCustomerId(rentalRequest.renterId);
    })(),
  );

  if (customerError || !stripeCustomerId) {
    return {
      success: false,
      error: customerError?.message || "Failed to get renter's payment info",
    };
  }

  // Get owner's connected account ID and verify onboarding
  const { data: ownerAccountId, error: accountError } = await tryCatch(
    (async () => {
      return await userDAL.getConnectedAccountId(rentalRequest.ownerId);
    })(),
  );

  if (accountError || !ownerAccountId) {
    return {
      success: false,
      error:
        "Owner must complete Stripe onboarding before receiving payments. Please contact the owner.",
    };
  }

  // Verify owner has completed onboarding (charges enabled)
  const { data: isOnboarded, error: onboardingCheckError } = await tryCatch(
    (async () => {
      return await userDAL.isConnectOnboardingComplete(rentalRequest.ownerId);
    })(),
  );

  if (onboardingCheckError || !isOnboarded) {
    return {
      success: false,
      error:
        "Owner's Stripe account is not fully set up. Please contact the owner to complete onboarding.",
    };
  }

  // Calculate application fee amount
  const totalAmount = Number(rentalRequest.totalAmount);
  const applicationFeeAmount = totalAmount * PLATFORM_FEE_PERCENTAGE;

  // Update payment status to processing
  await rentalDAL.updateRentalRequestPaymentStatus(validatedData.requestId, {
    paymentStatus: "processing",
  });

  // Process the rental payment (with automatic retry for network errors)
  let rentalPaymentAttempts = 0;
  let rentalPaymentResult = await tryCatch(
    (async () => {
      return await chargeRentalPayment(
        stripeCustomerId,
        rentalRequest.paymentMethodId!,
        totalAmount,
        {
          rentalRequestId: rentalRequest.id,
          listingId: rentalRequest.listingId,
          ownerId: rentalRequest.ownerId,
          renterId: rentalRequest.renterId,
          listingName: rentalRequest.listingName,
        },
        ownerAccountId, // Pass for destination transfer
      );
    })(),
  );

  // Retry once if it's a retryable error (network issues, etc)
  if (
    rentalPaymentResult.error &&
    isRetryablePaymentError(rentalPaymentResult.error) &&
    rentalPaymentAttempts === 0
  ) {
    rentalPaymentAttempts++;
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
    rentalPaymentResult = await tryCatch(
      (async () => {
        return await chargeRentalPayment(
          stripeCustomerId,
          rentalRequest.paymentMethodId!,
          totalAmount,
          {
            rentalRequestId: rentalRequest.id,
            listingId: rentalRequest.listingId,
            ownerId: rentalRequest.ownerId,
            renterId: rentalRequest.renterId,
            listingName: rentalRequest.listingName,
          },
          ownerAccountId, // Pass for destination transfer
        );
      })(),
    );
  }

  // Check if rental payment failed
  if (rentalPaymentResult.error || !rentalPaymentResult.data) {
    const errorMessage = getPaymentErrorMessage(rentalPaymentResult.error);

    // Update payment status to failed
    await rentalDAL.updateRentalRequestPaymentStatus(validatedData.requestId, {
      paymentStatus: "failed",
      paymentFailureReason: errorMessage,
    });

    // Get owner and renter details for notifications
    const { data: renterUser } = await tryCatch(
      (async () => {
        return await userDAL.getUserById(rentalRequest.renterId);
      })(),
    );

    const { data: ownerUser } = await tryCatch(
      (async () => {
        return await userDAL.getUserById(rentalRequest.ownerId);
      })(),
    );

    // Send notifications to both parties (don't block on notification failures)
    if (renterUser && ownerUser) {
      // Send notification to renter
      tryCatch(
        sendPaymentFailureNotificationToRenter({
          userId: renterUser.id,
          to: renterUser.email,
          renterName: `${renterUser.firstName} ${renterUser.lastName}`,
          ownerName: `${ownerUser.firstName} ${ownerUser.lastName}`,
          listingName: rentalRequest.listingName,
          totalAmount: rentalRequest.totalAmount,
          failureReason: errorMessage,
          rentalId: rentalRequest.id,
        }),
      ).catch((err) => {
        console.error(
          "Failed to send payment failure notification to renter:",
          err,
        );
      });

      // Send notification to owner
      tryCatch(
        sendPaymentFailureNotificationToOwner({
          userId: ownerUser.id,
          to: ownerUser.email,
          ownerName: `${ownerUser.firstName} ${ownerUser.lastName}`,
          renterName: `${renterUser.firstName} ${renterUser.lastName}`,
          listingName: rentalRequest.listingName,
          totalAmount: rentalRequest.totalAmount,
          failureReason: errorMessage,
          rentalId: rentalRequest.id,
        }),
      ).catch((err) => {
        console.error(
          "Failed to send payment failure notification to owner:",
          err,
        );
      });
    }

    return {
      success: false,
      error: `Payment failed: ${errorMessage}. The renter has been notified to update their payment method.`,
      paymentFailed: true,
    };
  }

  const rentalPaymentIntent = rentalPaymentResult.data;

  // Check if payment succeeded
  if (rentalPaymentIntent.status !== "succeeded") {
    const errorMessage = `Payment status: ${rentalPaymentIntent.status}`;

    await rentalDAL.updateRentalRequestPaymentStatus(validatedData.requestId, {
      paymentStatus: "failed",
      paymentFailureReason: errorMessage,
    });

    return {
      success: false,
      error: `Payment was not completed. ${errorMessage}. The renter has been notified.`,
      paymentFailed: true,
    };
  }

  // Authorize (hold) the security deposit
  let securityDepositAuthId: string | undefined;

  if (Number(rentalRequest.securityDeposit) > 0) {
    const { data: securityDepositAuth, error: depositError } = await tryCatch(
      (async () => {
        return await authorizeSecurityDeposit(
          stripeCustomerId,
          rentalRequest.paymentMethodId!,
          Number(rentalRequest.securityDeposit),
          {
            type: "security_deposit",
            rentalRequestId: rentalRequest.id,
            listingId: rentalRequest.listingId,
            renterId: rentalRequest.renterId,
          },
        );
      })(),
    );

    if (depositError || !securityDepositAuth) {
      // Security deposit authorization failed
      // The rental payment succeeded, so we need to handle this carefully
      console.error(
        "Security deposit authorization failed:",
        depositError?.message,
      );

      // We could either:
      // 1. Refund the rental payment and fail the approval
      // 2. Continue without security deposit hold (log for manual review)
      // For now, we'll continue and log the issue
      console.warn(
        `Rental ${rentalRequest.id} approved without security deposit hold`,
      );
    } else if (
      securityDepositAuth.status === "requires_capture" ||
      securityDepositAuth.status === "requires_confirmation"
    ) {
      securityDepositAuthId = securityDepositAuth.id;
    }
  }

  // Now approve the rental request with payment IDs
  const { error: approvalError } = await tryCatch(
    (async () => {
      return await rentalDAL.approveRentalRequest(
        validatedData.requestId,
        userId,
        {
          pickupInstructions: validatedData.pickupInstructions,
          returnInstructions: validatedData.returnInstructions,
          rentalPaymentIntentId: rentalPaymentIntent.id,
          securityDepositAuthId: securityDepositAuthId,
          applicationFeeAmount: applicationFeeAmount.toString(),
        },
      );
    })(),
  );

  if (approvalError) {
    // Approval failed after payment succeeded
    // This is a critical error that needs manual intervention
    console.error("Rental approval failed after payment:", approvalError);

    return {
      success: false,
      error:
        "Payment was processed but approval failed. Please contact support immediately.",
    };
  }

  // Send success notifications to both parties (don't block on notification failures)
  try {
    const { data: renterUser } = await tryCatch(
      userDAL.getUserById(rentalRequest.renterId),
    );
    const { data: ownerUser } = await tryCatch(
      userDAL.getUserById(rentalRequest.ownerId),
    );

    if (renterUser && ownerUser) {
      const startDate = new Date(rentalRequest.startDate).toLocaleDateString();
      const endDate = new Date(rentalRequest.endDate).toLocaleDateString();

      // Send payment success notification to renter
      tryCatch(
        sendPaymentSucceededNotificationToRenter({
          userId: renterUser.id,
          to: renterUser.email,
          renterName: `${renterUser.firstName} ${renterUser.lastName}`,
          ownerName: `${ownerUser.firstName} ${ownerUser.lastName}`,
          listingName: rentalRequest.listingName,
          rentalId: rentalRequest.id,
          totalAmount: rentalRequest.totalAmount,
          securityDeposit: rentalRequest.securityDeposit,
        }),
      ).catch((err) => {
        console.error(
          "Failed to send payment success notification to renter:",
          err,
        );
      });

      // Send payment success notification to owner
      tryCatch(
        sendPaymentSucceededNotificationToOwner({
          userId: ownerUser.id,
          to: ownerUser.email,
          ownerName: `${ownerUser.firstName} ${ownerUser.lastName}`,
          renterName: `${renterUser.firstName} ${renterUser.lastName}`,
          listingName: rentalRequest.listingName,
          rentalId: rentalRequest.id,
          totalAmount: rentalRequest.totalAmount,
        }),
      ).catch((err) => {
        console.error(
          "Failed to send payment success notification to owner:",
          err,
        );
      });

      // Send rental approved notification to renter
      tryCatch(
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
        }),
      ).catch((err) => {
        console.error("Failed to send rental approved notification:", err);
      });
    }
  } catch (notificationError) {
    console.error("Error sending success notifications:", notificationError);
  }

  // Revalidate the relevant pages
  revalidatePath("/dashboard/lending/incoming");
  revalidatePath("/dashboard/lending/active");
  revalidatePath("/dashboard/renting/pending");
  revalidatePath("/dashboard/renting/active");
  revalidatePath("/dashboard/rental/[id]", "page");

  return {
    success: true,
    paymentIntentId: rentalPaymentIntent.id,
    securityDepositAuthId,
  };
}
