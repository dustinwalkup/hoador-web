import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { reviewDAL } from "@/dal";
import {
  reviewSchema,
  type ReviewFormData,
} from "@/features/reviews/schemas/review-schema";
import {
  getAuthenticatedUserResponse,
  handleApiError,
  parseFormData,
} from "@/lib/api/route-helpers";

/**
 * POST /api/reviews
 * Create a new review
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    // Parse FormData or JSON
    const body = await parseFormData(request);

    // Parse numeric fields from FormData strings
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

    // Validate with Zod schema
    const validatedData = reviewSchema.parse(data);

    // Transform null to undefined for optional rating fields
    const reviewData = {
      ...validatedData,
      accuracyRating: validatedData.accuracyRating ?? undefined,
      listingConditionRating: validatedData.listingConditionRating ?? undefined,
      ownerCommunicationRating:
        validatedData.ownerCommunicationRating ?? undefined,
    };

    // Create review
    const { data: review, error } = await tryCatch(
      reviewDAL.createReview(userId, reviewData),
    );

    if (error) {
      return handleApiError(error);
    }

    return Response.json(
      {
        success: true,
        reviewId: review?.id,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/reviews
 * Get a review by rentalId or requestId
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rentalId = searchParams.get("rentalId");
    const requestId = searchParams.get("requestId");

    if (!rentalId && !requestId) {
      return Response.json(
        { error: "rentalId or requestId query parameter is required" },
        { status: 400 },
      );
    }

    const { data: review, error } = await tryCatch(
      requestId
        ? reviewDAL.getReviewByRequestId(requestId)
        : reviewDAL.getReviewByRentalId(rentalId!),
    );

    if (error) {
      console.error("Error fetching review:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch review";

      // Log full error details for debugging
      console.error("Full error details:", {
        message: errorMessage,
        error,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return Response.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: 500 },
      );
    }

    return Response.json({
      review: review || null,
    });
  } catch (error) {
    console.error("Error in GET /api/reviews:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      },
      { status: 500 },
    );
  }
}
