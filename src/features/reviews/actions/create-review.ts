"use server";

import { reviewDAL } from "@/dal";
import { reviewSchema, type ReviewFormData } from "../schemas/review-schema";
import { tryCatch } from "@walkup/walkup-utils";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/features/auth/utils/session";

export async function createReviewAction(
  prevState: { success: boolean; error?: string },
  formData: FormData,
): Promise<{ success: boolean; error?: string; reviewId?: string }> {
  try {
    // Authenticate user
    const userId = await getCurrentUserId();
    if (!userId) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    // Parse form data
    const rentalId = formData.get("rentalId") as string;
    const requestId = formData.get("requestId") as string;
    const data: ReviewFormData = {
      ...(rentalId ? { rentalId } : {}),
      ...(requestId ? { requestId } : {}),
      rating: Number(formData.get("rating")),
      comment: formData.get("comment") as string,
      accuracyRating: formData.get("accuracyRating")
        ? Number(formData.get("accuracyRating"))
        : undefined,
      listingConditionRating: formData.get("listingConditionRating")
        ? Number(formData.get("listingConditionRating"))
        : undefined,
      ownerCommunicationRating: formData.get("ownerCommunicationRating")
        ? Number(formData.get("ownerCommunicationRating"))
        : undefined,
    };

    // Validate with Zod schema and transform null to undefined
    const validatedData = reviewSchema.parse(data);
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
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create review",
      };
    }

    // Revalidate relevant paths
    const rentalIdForPath = validatedData.rentalId || validatedData.requestId;
    if (rentalIdForPath) {
      revalidatePath(`/dashboard/rental/${rentalIdForPath}`);
    }
    revalidatePath("/dashboard/renting/completed");
    revalidatePath("/dashboard/lending/completed");

    return {
      success: true,
      reviewId: review?.id,
    };
  } catch (error) {
    console.error("Error in createReviewAction:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

// Direct call version for useTransition pattern
export async function createReview(
  data: ReviewFormData,
): Promise<{ success: boolean; error?: string; reviewId?: string }> {
  try {
    // Authenticate user
    const userId = await getCurrentUserId();
    if (!userId) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    // Validate with Zod schema and transform null to undefined
    const validatedData = reviewSchema.parse(data);
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
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create review",
      };
    }

    // Revalidate relevant paths
    const rentalId = validatedData.rentalId || validatedData.requestId;
    if (rentalId) {
      revalidatePath(`/dashboard/rental/${rentalId}`);
    }
    revalidatePath("/dashboard/renting/completed");
    revalidatePath("/dashboard/lending/completed");

    return {
      success: true,
      reviewId: review?.id,
    };
  } catch (error) {
    console.error("Error in createReview:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
