import { useQueryClient } from "@tanstack/react-query";
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import type { ReviewFormData } from "../schemas/review-schema";

/**
 * Hook for creating a review
 * Invalidates reviews and rental-details queries on success
 */
export function useCreateReview() {
  const queryClient = useQueryClient();

  return useCreateMutation({
    mutationFn: async (data: ReviewFormData) => {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create review");
      }

      return response.json();
    },
    successMessage: "Review submitted successfully!",
    invalidateQueryKeys: [["reviews"], ["rental-details"]],
    onSuccess: (data, variables) => {
      // Invalidate specific rental query if rentalId or requestId is provided
      const rentalId = variables.rentalId || variables.requestId;
      if (rentalId) {
        queryClient.invalidateQueries({
          queryKey: ["rental-details", rentalId],
        });
      }

      // Invalidate completed rentals pages
      queryClient.invalidateQueries({
        queryKey: ["rentals", "completed"],
      });
    },
  });
}
