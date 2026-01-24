import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { reviewDAL } from "@/dal";
import { reviewSchema } from "@/features/reviews/schemas/review-schema";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    const body = await request.json();

    // Validate request body - allow either rentalId or requestId
    const validatedData = reviewSchema.parse(body);

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
      console.error("Error creating review:", error);
      return handleApiError(error);
    }

    return Response.json(
      {
        success: true,
        review,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in POST /api/reviews:", error);
    return handleApiError(error);
  }
}

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
