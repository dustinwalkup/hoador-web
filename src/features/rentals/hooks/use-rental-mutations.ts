import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import { rentalKeys } from "./use-rentals";
import type { CreateRentalRequestFormData } from "../lib/form-schema";

/**
 * Hook for creating a new rental request
 */
export function useCreateRentalRequest() {
  const router = useRouter();

  return useCreateMutation({
    mutationFn: async (data: CreateRentalRequestFormData) => {
      // Convert dates to ISO strings for JSON serialization
      const payload = {
        ...data,
        startDate:
          data.startDate instanceof Date
            ? data.startDate.toISOString()
            : data.startDate,
        endDate:
          data.endDate instanceof Date
            ? data.endDate.toISOString()
            : data.endDate,
      };

      const response = await fetch("/api/rentals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create rental request");
      }

      return response.json();
    },
    successMessage: "Rental request submitted successfully! The owner will be notified and you'll receive an update soon.",
    invalidateQueryKeys: [
      rentalKeys.all,
      rentalKeys.renting(),
      rentalKeys.lending(),
    ],
    onSuccess: (data) => {
      // Navigate to rental detail page if requestId is returned
      if (data.requestId) {
        router.push(`/dashboard/rental/${data.requestId}`);
      }
    },
  });
}

/**
 * Hook for approving a rental request
 */
export function useApproveRentalRequest() {
  const queryClient = useQueryClient();

  return useCreateMutation({
    mutationFn: async ({
      rentalId,
      pickupInstructions,
      returnInstructions,
    }: {
      rentalId: string;
      pickupInstructions?: string;
      returnInstructions?: string;
    }) => {
      const response = await fetch(`/api/rentals/${rentalId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupInstructions,
          returnInstructions,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorObj = new Error(
          error.error || "Failed to approve rental request",
        );
        // Attach paymentFailed flag if present
        if (error.paymentFailed) {
          (errorObj as Error & { paymentFailed?: boolean }).paymentFailed =
            true;
        }
        throw errorObj;
      }

      return response.json();
    },
    successMessage:
      "Request approved successfully! Payment has been processed.",
    invalidateQueryKeys: [
      rentalKeys.all,
      rentalKeys.renting(),
      rentalKeys.lending(),
      ["garage"], // Invalidate garage to update listing availability
    ],
    onSuccess: (data, variables) => {
      // Invalidate specific rental detail query
      queryClient.invalidateQueries({
        queryKey: rentalKeys.detail(variables.rentalId),
      });
    },
    // Note: Error handling is done via the toast in useCreateMutation
    // The error with paymentFailed flag is already set from API and propagated
  });
}

/**
 * Hook for declining a rental request
 */
export function useDeclineRentalRequest() {
  const queryClient = useQueryClient();

  return useCreateMutation({
    mutationFn: async ({
      rentalId,
      denialReason,
    }: {
      rentalId: string;
      denialReason: string;
    }) => {
      const response = await fetch(`/api/rentals/${rentalId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ denialReason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to decline rental request");
      }

      return response.json();
    },
    successMessage: "Rental request declined",
    invalidateQueryKeys: [
      rentalKeys.all,
      rentalKeys.renting(),
      rentalKeys.lending(),
    ],
    onSuccess: (data, variables) => {
      // Invalidate specific rental detail query
      queryClient.invalidateQueries({
        queryKey: rentalKeys.detail(variables.rentalId),
      });
    },
  });
}

/**
 * Hook for canceling a rental request
 */
export function useCancelRentalRequest() {
  const queryClient = useQueryClient();

  return useCreateMutation({
    mutationFn: async (rentalId: string) => {
      const response = await fetch(`/api/rentals/${rentalId}/cancel`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel rental request");
      }

      return response.json();
    },
    successMessage: "Rental request cancelled",
    invalidateQueryKeys: [
      rentalKeys.all,
      rentalKeys.renting(),
      rentalKeys.lending(),
    ],
    onSuccess: (data, variables) => {
      // Invalidate specific rental detail query
      queryClient.invalidateQueries({
        queryKey: rentalKeys.detail(variables),
      });
    },
  });
}

/**
 * Hook for starting a rental
 */
export function useStartRental() {
  const queryClient = useQueryClient();

  return useCreateMutation({
    mutationFn: async (rentalId: string) => {
      const response = await fetch(`/api/rentals/${rentalId}/start`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start rental");
      }

      return response.json();
    },
    successMessage: "Rental started successfully",
    invalidateQueryKeys: [
      rentalKeys.all,
      rentalKeys.renting(),
      rentalKeys.lending(),
    ],
    onSuccess: (data, variables) => {
      // Invalidate specific rental detail query
      queryClient.invalidateQueries({
        queryKey: rentalKeys.detail(variables),
      });
    },
  });
}

/**
 * Hook for ending a rental
 */
export function useEndRental() {
  const queryClient = useQueryClient();

  return useCreateMutation({
    mutationFn: async (rentalId: string) => {
      const response = await fetch(`/api/rentals/${rentalId}/end`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to end rental");
      }

      return response.json();
    },
    successMessage: "Rental ended successfully",
    invalidateQueryKeys: [
      rentalKeys.all,
      rentalKeys.renting(),
      rentalKeys.lending(),
    ],
    onSuccess: (data, variables) => {
      // Invalidate specific rental detail query
      queryClient.invalidateQueries({
        queryKey: rentalKeys.detail(variables),
      });
    },
  });
}

/**
 * Hook for updating rental instructions
 */
export function useUpdateRentalInstructions() {
  const queryClient = useQueryClient();

  return useCreateMutation({
    mutationFn: async ({
      rentalId,
      pickupInstructions,
      returnInstructions,
    }: {
      rentalId: string;
      pickupInstructions?: string;
      returnInstructions?: string;
    }) => {
      const response = await fetch(`/api/rentals/${rentalId}/instructions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupInstructions,
          returnInstructions,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update instructions");
      }

      return response.json();
    },
    successMessage: "Instructions updated successfully",
    invalidateQueryKeys: [
      rentalKeys.all,
      rentalKeys.renting(),
      rentalKeys.lending(),
    ],
    onSuccess: (data, variables) => {
      // Invalidate specific rental detail query
      queryClient.invalidateQueries({
        queryKey: rentalKeys.detail(variables.rentalId),
      });
    },
  });
}
