import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  requireAuthResponse,
  parseFormData,
  getCurrentUserId,
} from "@/lib/api/route-helpers";
import { submitServiceReviewSchema } from "@/features/services/lib/service-api-schemas";
import { ServiceReviewService } from "@/features/services/services/service-review-service";

/**
 * POST /api/services/bookings/[id]/reviews
 * Submit a review for a completed booking (one per party).
 */
async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = await parseFormData(request);
    const parsed = submitServiceReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { error } = await tryCatch(
      ServiceReviewService.submitReview(id, userId, {
        rating: parsed.data.rating,
        comment: parsed.data.comment,
      }),
    );

    if (error) {
      return handleApiError(error);
    }

    return NextResponse.json({ submitted: true as const });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/services/bookings/[id]/reviews",
);
