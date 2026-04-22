import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { createBlindReviewSchema } from "@/features/reviews/schemas/blind-review-schema";
import { BlindReviewService } from "@/features/reviews/services/blind-review-service";

/**
 * POST /api/reviews
 * Submit a blind review for a completed booking.
 */
async function postHandler(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId } = authResult;

    const body = await request.json();
    const validated = createBlindReviewSchema.parse(body);

    const { reviewId } = await BlindReviewService.submitReview({
      userId,
      ...validated,
    });

    return NextResponse.json({ success: true, reviewId }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(postHandler, "POST /api/reviews");

/**
 * GET /api/reviews
 * Query modes:
 * - ?rentalId=<id>           → released reviews for rental + reviewStatus for authenticated user
 * - ?serviceBookingId=<id>   → released reviews for service booking + reviewStatus
 * - ?revieweeId=<id>         → paginated released reviews for a user + aggregate
 */
async function getHandler(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId } = authResult;

    const searchParams = request.nextUrl.searchParams;
    const rentalId = searchParams.get("rentalId");
    const serviceBookingId = searchParams.get("serviceBookingId");
    const revieweeId = searchParams.get("revieweeId");

    // Mode: user profile reviews
    if (revieweeId) {
      const limit = Math.min(
        Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1),
        100,
      );
      const offset = Math.max(
        parseInt(searchParams.get("offset") ?? "0", 10) || 0,
        0,
      );

      const result = await BlindReviewService.getUserReviews(revieweeId, {
        limit,
        offset,
      });

      return NextResponse.json(result);
    }

    // Mode: booking reviews
    if (rentalId || serviceBookingId) {
      const bookingParams = rentalId
        ? { rentalId }
        : { serviceBookingId: serviceBookingId! };

      const [reviews, reviewStatus] = await Promise.all([
        BlindReviewService.getBookingReviews(bookingParams),
        BlindReviewService.getReviewStatus(userId, bookingParams),
      ]);

      return NextResponse.json({ reviews, reviewStatus });
    }

    return NextResponse.json(
      { error: "One of rentalId, serviceBookingId, or revieweeId is required" },
      { status: 400 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(getHandler, "GET /api/reviews");
