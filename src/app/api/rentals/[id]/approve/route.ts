import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { tryCatch } from "@walkup/walkup-utils";
import { rentalDAL, userDAL, paymentDAL } from "@/dal";
import { rentals } from "@/db/schemas/rentals.schema";
import { db } from "@/db/db";
import {
  handleApiError,
  parseFormData,
  requireAuthResponse,
} from "@/lib/api/route-helpers";
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
} from "@/features/rentals/notifications/payment-failure";
import {
  sendPaymentSucceededNotificationToRenter,
  sendPaymentSucceededNotificationToOwner,
} from "@/features/rentals/notifications/payment-succeeded";
import { sendRentalApprovedNotification } from "@/features/rentals/notifications/rental-approved";

const approveRequestSchema = z.object({
  pickupInstructions: z.string().optional(),
  returnInstructions: z.string().optional(),
});

/**
 * POST /api/rentals/[id]/approve
 * Approve a rental request and process payment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Check authentication
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const { id: rentalId } = await params;

    // Parse request body
    const body = await parseFormData(request);

    // Validate input data
    const parseResult = approveRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid data provided" },
        { status: 400 },
      );
    }

    const validatedData = parseResult.data;

    // Get current user ID for authorization
    const { getCurrentUserId } = await import("@/features/auth/utils/session");
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Fetch rental request details
    const { data: rentalRequest, error: fetchError } = await tryCatch(
      rentalDAL.getRentalRequestById(rentalId, currentUserId),
    );

    if (fetchError || !rentalRequest) {
      return NextResponse.json(
        { error: fetchError?.message || "Rental request not found" },
        { status: 404 },
      );
    }

    // Authorization check: only owner can approve
    if (rentalRequest.ownerId !== currentUserId) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Only the listing owner can approve rental requests",
        },
        { status: 403 },
      );
    }

    // Check if payment method is available
    if (!rentalRequest.paymentMethodId) {
      return NextResponse.json(
        { error: "No payment method on file for renter" },
        { status: 400 },
      );
    }

    // Get or create Stripe customer ID for the renter
    const { data: stripeCustomerId, error: customerError } = await tryCatch(
      userDAL.getOrCreateStripeCustomerId(rentalRequest.renterId),
    );

    if (customerError || !stripeCustomerId) {
      return NextResponse.json(
        {
          error:
            customerError?.message || "Failed to get renter's payment info",
        },
        { status: 500 },
      );
    }

    // Get owner's connected account ID and verify onboarding
    const { data: ownerAccountId, error: accountError } = await tryCatch(
      userDAL.getConnectedAccountId(rentalRequest.ownerId),
    );

    if (accountError || !ownerAccountId) {
      return NextResponse.json(
        {
          error:
            "Owner must complete Stripe onboarding before receiving payments. Please contact the owner.",
        },
        { status: 400 },
      );
    }

    // Verify owner has completed onboarding (charges enabled)
    const { data: isOnboarded, error: onboardingCheckError } = await tryCatch(
      userDAL.isConnectOnboardingComplete(rentalRequest.ownerId),
    );

    if (onboardingCheckError || !isOnboarded) {
      return NextResponse.json(
        {
          error:
            "Owner's Stripe account is not fully set up. Please contact the owner to complete onboarding.",
        },
        { status: 400 },
      );
    }

    // Calculate application fee amount
    const totalAmount = Number(rentalRequest.totalAmount);
    const applicationFeeAmount = totalAmount * PLATFORM_FEE_PERCENTAGE;

    // Update payment status to processing
    await rentalDAL.updateRentalRequestPaymentStatus(rentalId, {
      paymentStatus: "processing",
    });

    // Process the rental payment (with automatic retry for network errors)
    let rentalPaymentAttempts = 0;
    let rentalPaymentResult = await tryCatch(
      chargeRentalPayment(
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
      ),
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
        chargeRentalPayment(
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
        ),
      );
    }

    // Check if rental payment failed
    if (rentalPaymentResult.error || !rentalPaymentResult.data) {
      const errorMessage = getPaymentErrorMessage(rentalPaymentResult.error);

      // Update payment status to failed
      await rentalDAL.updateRentalRequestPaymentStatus(rentalId, {
        paymentStatus: "failed",
        paymentFailureReason: errorMessage,
      });

      // Get owner and renter details for notifications
      const { data: renterUser } = await tryCatch(
        userDAL.getUserById(rentalRequest.renterId),
      );

      const { data: ownerUser } = await tryCatch(
        userDAL.getUserById(rentalRequest.ownerId),
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

      return NextResponse.json(
        {
          error: `Payment failed: ${errorMessage}. The renter has been notified to update their payment method.`,
          paymentFailed: true,
        },
        { status: 400 },
      );
    }

    const rentalPaymentIntent = rentalPaymentResult.data;

    // Check if payment succeeded
    if (rentalPaymentIntent.status !== "succeeded") {
      const errorMessage = `Payment status: ${rentalPaymentIntent.status}`;

      await rentalDAL.updateRentalRequestPaymentStatus(rentalId, {
        paymentStatus: "failed",
        paymentFailureReason: errorMessage,
      });

      return NextResponse.json(
        {
          error: `Payment was not completed. ${errorMessage}. The renter has been notified.`,
          paymentFailed: true,
        },
        { status: 400 },
      );
    }

    // Authorize (hold) the security deposit
    let securityDepositAuthId: string | undefined;

    if (Number(rentalRequest.securityDeposit) > 0) {
      const { data: securityDepositAuth, error: depositError } = await tryCatch(
        authorizeSecurityDeposit(
          stripeCustomerId,
          rentalRequest.paymentMethodId!,
          Number(rentalRequest.securityDeposit),
          {
            type: "security_deposit",
            rentalRequestId: rentalRequest.id,
            listingId: rentalRequest.listingId,
            renterId: rentalRequest.renterId,
          },
        ),
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
      rentalDAL.approveRentalRequest(rentalId, currentUserId, {
        pickupInstructions: validatedData.pickupInstructions,
        returnInstructions: validatedData.returnInstructions,
        rentalPaymentIntentId: rentalPaymentIntent.id,
        securityDepositAuthId: securityDepositAuthId,
        applicationFeeAmount: applicationFeeAmount.toString(),
      }),
    );

    if (approvalError) {
      // Approval failed after payment succeeded
      // This is a critical error that needs manual intervention
      console.error("Rental approval failed after payment:", approvalError);

      return NextResponse.json(
        {
          error:
            "Payment was processed but approval failed. Please contact support immediately.",
        },
        { status: 500 },
      );
    }

    // Get the rental that was just created to get its ID
    const { data: createdRental, error: rentalQueryError } = await tryCatch(
      db
        .select()
        .from(rentals)
        .where(eq(rentals.requestId, rentalId))
        .limit(1)
        .then((results) => results[0]),
    );

    if (rentalQueryError || !createdRental) {
      console.error(
        "Failed to query created rental for payment record:",
        rentalQueryError,
      );
      // Continue anyway - payment record creation is not critical
    } else {
      // Create payment record in database
      const { error: paymentRecordError } = await tryCatch(
        paymentDAL.createPayment({
          rentalId: createdRental.id,
          payerId: rentalRequest.renterId,
          payeeId: rentalRequest.ownerId,
          amount: totalAmount.toString(),
          platformFee: applicationFeeAmount.toString(),
          paymentMethodId: rentalRequest.paymentMethodId || undefined,
          stripePaymentIntentId: rentalPaymentIntent.id,
          status: "succeeded",
          paidAt: new Date(),
        }),
      );

      if (paymentRecordError) {
        console.error(
          "Failed to create payment record (payment succeeded):",
          paymentRecordError,
        );
        // Continue anyway - payment succeeded, record creation is for history
      }
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
        const startDate = new Date(
          rentalRequest.startDate,
        ).toLocaleDateString();
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

    return NextResponse.json({
      success: true,
      paymentIntentId: rentalPaymentIntent.id,
      securityDepositAuthId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
