import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { z } from "zod";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  parseFormData,
  requireAuthResponse,
  getClientIP,
  getUserAgent,
} from "@/lib/api/route-helpers";
import { NotFoundError } from "@/dal/errors";
import {
  RentalService,
  type ApproveRentalRequestInput,
} from "@/features/rentals/services/rental-service";

const approveRequestSchema = z.object({
  pickupInstructions: z.string().optional(),
  returnInstructions: z.string().optional(),
});

/**
 * POST /api/rentals/[id]/approve
 * Approve a rental request and process payment
 */
async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const { id: rentalId } = await params;

    const body = await parseFormData(request);
    const parseResult = approveRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid data provided" },
        { status: 400 },
      );
    }

    const validatedData: ApproveRentalRequestInput = parseResult.data;

    const { getCurrentUserId } = await import("@/features/auth/utils/session");
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);

    const result = await tryCatch(
      RentalService.approveRentalRequest(
        rentalId,
        currentUserId,
        validatedData,
        {
          ipAddress,
          userAgent,
        },
      ),
    );

    if (result.error) {
      if (result.error instanceof NotFoundError) {
        return NextResponse.json(
          { error: result.error.message || "Rental request not found" },
          { status: 404 },
        );
      }
      const message =
        result.error instanceof Error
          ? result.error.message
          : "An error occurred";
      if (message.includes("Forbidden")) {
        return NextResponse.json({ error: message }, { status: 403 });
      }
      if (
        message.includes("payment method") ||
        message.includes("onboarding") ||
        message.includes("Stripe")
      ) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      return handleApiError(result.error);
    }

    const data = result.data;
    if (!data) {
      return NextResponse.json(
        { error: "Failed to approve rental request" },
        { status: 500 },
      );
    }

    if (!data.success) {
      return NextResponse.json(
        {
          error: data.paymentFailed
            ? `Payment failed: ${data.error}. The renter has been notified to update their payment method.`
            : data.error,
          paymentFailed: data.paymentFailed ?? false,
        },
        { status: data.paymentFailed ? 400 : 500 },
      );
    }

    return NextResponse.json({
      success: true,
      paymentIntentId: data.paymentIntentId,
      securityDepositAuthId: data.securityDepositAuthId,
      depositHoldStatus: data.depositHoldStatus,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/rentals/[id]/approve",
);
