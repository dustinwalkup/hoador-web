import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  reviewSchema,
  type ReviewFormData,
} from "@/features/reviews/schemas/review-schema";
import {
  getAuthenticatedUserResponse,
  handleApiError,
  parseFormData,
} from "@/lib/api/route-helpers";
import { ReviewService } from "@/features/reviews/services/review-service";

/**
 * POST /api/reviews
 * Create a new review
 */
async function postHandler(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId } = authResult;

    const body = await parseFormData(request);

    const data: ReviewFormData = {
      ...(body.rentalId ? { rentalId: body.rentalId as string } : {}),
      ...(body.requestId ? { requestId: body.requestId as string } : {}),
      rating:
        typeof body.rating === "string"
          ? Number(body.rating)
          : (body.rating as number),
      comment: body.comment as string,
      accuracyRating: body.accuracyRating
        ? typeof body.accuracyRating === "string"
          ? Number(body.accuracyRating)
          : (body.accuracyRating as number)
        : undefined,
      listingConditionRating: body.listingConditionRating
        ? typeof body.listingConditionRating === "string"
          ? Number(body.listingConditionRating)
          : (body.listingConditionRating as number)
        : undefined,
      ownerCommunicationRating: body.ownerCommunicationRating
        ? typeof body.ownerCommunicationRating === "string"
          ? Number(body.ownerCommunicationRating)
          : (body.ownerCommunicationRating as number)
        : undefined,
    };

    const validatedData = reviewSchema.parse(data);

    const reviewData = {
      ...validatedData,
      accuracyRating: validatedData.accuracyRating ?? undefined,
      listingConditionRating: validatedData.listingConditionRating ?? undefined,
      ownerCommunicationRating:
        validatedData.ownerCommunicationRating ?? undefined,
    };

    const { reviewId } = await ReviewService.createReview(userId, reviewData);

    return NextResponse.json(
      {
        success: true,
        reviewId,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(postHandler, "POST /api/reviews");

/**
 * GET /api/reviews
 * Get a review by rentalId or requestId
 */
async function getHandler(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const searchParams = request.nextUrl.searchParams;
    const rentalId = searchParams.get("rentalId");
    const requestId = searchParams.get("requestId");

    const review = await ReviewService.getReviewByRentalOrRequest({
      rentalId,
      requestId,
    });

    return NextResponse.json({ review: review || null });
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(getHandler, "GET /api/reviews");
