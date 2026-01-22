import { useQueryClient } from "@tanstack/react-query";
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import type { CreateListingFormDataServerType } from "../form-schema/listing.schema";

/**
 * Hook for creating a new listing
 */
export function useCreateListing() {
  const queryClient = useQueryClient();

  return useCreateMutation({
    mutationFn: async (data: CreateListingFormDataServerType) => {
      const response = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create listing");
      }

      return response.json();
    },
    successMessage: "Listing created successfully",
    invalidateQueryKeys: [["listings"], ["garage"], ["listing-details"]],
    onSuccess: (data) => {
      // Invalidate specific listing query if listingId is returned
      if (data.listingId) {
        queryClient.invalidateQueries({
          queryKey: ["listing-details", data.listingId],
        });
      }
    },
  });
}

/**
 * Hook for updating an existing listing
 */
export function useUpdateListing() {
  const queryClient = useQueryClient();

  return useCreateMutation({
    mutationFn: async ({
      listingId,
      data,
    }: {
      listingId: string;
      data: CreateListingFormDataServerType;
    }) => {
      const response = await fetch(`/api/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update listing");
      }

      return response.json();
    },
    successMessage: "Listing updated successfully",
    invalidateQueryKeys: [["listings"], ["garage"], ["listing-details"]],
    onSuccess: (data, variables) => {
      // Invalidate specific listing query
      queryClient.invalidateQueries({
        queryKey: ["listing-details", variables.listingId],
      });
    },
  });
}

/**
 * Hook for updating listing status
 */
export function useUpdateListingStatus() {
  const queryClient = useQueryClient();

  return useCreateMutation({
    mutationFn: async ({
      listingId,
      status,
    }: {
      listingId: string;
      status: "available" | "maintenance" | "inactive";
    }) => {
      const response = await fetch(`/api/listings/${listingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update listing status");
      }

      return response.json();
    },
    successMessage: "Listing status updated successfully",
    invalidateQueryKeys: [
      ["listings"],
      ["garage"],
      ["listing-details"],
      ["explore"],
    ],
    onSuccess: (data, variables) => {
      // Invalidate specific listing query
      queryClient.invalidateQueries({
        queryKey: ["listing-details", variables.listingId],
      });
    },
  });
}

/**
 * Hook for analyzing tool images
 */
export function useAnalyzeToolImage() {
  return useCreateMutation({
    mutationFn: async (imageUrls: string | string[]) => {
      const response = await fetch("/api/listings/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to analyze image");
      }

      return response.json();
    },
    // No success message for analysis - it's used internally
    successMessage: undefined,
    // No cache invalidation needed for analysis
    invalidateQueryKeys: [],
  });
}
