import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  parseFormData,
  getClientIP,
  getUserAgent,
  requireAuthResponse,
} from "@/lib/api/route-helpers";
import { createRentalRequestSchema } from "@/features/rentals/lib/form-schema";
import { RentalService } from "@/features/rentals/services/rental-service";

/**
 * POST /api/rentals
 * Create a new rental request
 */
async function postHandler(request: NextRequest) {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const body = await parseFormData(request);
    const processedBody = {
      ...body,
      startDate:
        typeof body.startDate === "string"
          ? new Date(body.startDate)
          : body.startDate,
      endDate:
        typeof body.endDate === "string"
          ? new Date(body.endDate)
          : body.endDate,
    };

    const validationResult = createRentalRequestSchema.safeParse(processedBody);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const validatedData = validationResult.data;

    const { getCurrentUserId } = await import("@/features/auth/utils/session");
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json(
        { error: "You must be logged in to create a rental request" },
        { status: 401 },
      );
    }

    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);

    const { data: rentalRequest, error } = await tryCatch(
      RentalService.createRentalRequest(validatedData, currentUserId, {
        ipAddress,
        userAgent,
        meta: {
          fbp: validatedData.metaFbp,
          fbc: validatedData.metaFbc,
          sourceUrl: validatedData.metaSourceUrl,
        },
      }),
    );

    if (error) {
      return handleApiError(error);
    }

    if (!rentalRequest) {
      return NextResponse.json(
        { error: "Failed to create rental request" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      requestId: rentalRequest.id,
      message:
        "Rental request submitted successfully! The owner will be notified and you'll receive an update soon.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(postHandler, "POST /api/rentals");
