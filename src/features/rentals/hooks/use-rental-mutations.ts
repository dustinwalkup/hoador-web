import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useCreateMutation,
  handleMutationSuccess,
} from "@/lib/react-query/mutation-helpers";
import { rentalKeys } from "./use-rentals";
import type { CreateRentalRequestFormData } from "../lib/form-schema";

/** Successful JSON body from POST /api/rentals/[id]/cancel (refund failures use 422). */
export interface CancelRentalResponse {
  success: true;
  refundAmount?: number;
  ownerTransferAmount?: number;
}

/**
 * Hook for creating a new rental request
 */
export function useCreateRentalRequest() {
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
    successMessage:
      "Rental request submitted successfully! The owner will be notified and you'll receive an update soon.",
    invalidateQueryKeys: [
      rentalKeys.all,
      rentalKeys.renting(),
      rentalKeys.lending(),
    ],
    // Redirect is handled by the rent flow component (so it can show push prompt first)
  });
}

/**
 * Hook for approving a rental request
 */
export function useApproveRentalRequest() {
  const queryClient = useQueryClient();
  const router = useRouter();

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
        if (
          response.status === 403 &&
          error.error === "PAYMENT_SETUP_REQUIRED"
        ) {
          // The dialog catches this code and redirects to the JIT onboarding
          // page; suppressToast prevents handleMutationError from flashing a
          // generic error before the navigation happens.
          Object.assign(errorObj, {
            code: "PAYMENT_SETUP_REQUIRED",
            onboardingStatus: error.onboardingStatus,
            suppressToast: true,
          });
        } else if (error.paymentFailed) {
          (errorObj as Error & { paymentFailed?: boolean }).paymentFailed =
            true;
        }
        throw errorObj;
      }

      return response.json();
    },
    invalidateQueryKeys: [
      rentalKeys.all,
      rentalKeys.renting(),
      rentalKeys.lending(),
      ["garage"], // Invalidate garage to update listing availability
    ],
    onSuccess: (data, variables) => {
      // Show amber warning toast if deposit hold failed, green success otherwise
      if (data?.depositHoldStatus === "failed") {
        toast.warning(
          "Request approved, but the security deposit hold failed. The renter has been notified to update their payment method.",
          { duration: 6000 },
        );
      } else {
        toast.success(
          "Request approved successfully! Payment has been processed.",
          { duration: 3000 },
        );
      }

      // Invalidate specific rental detail query (for any client-side usage)
      queryClient.invalidateQueries({
        queryKey: rentalKeys.detail(variables.rentalId),
      });
      // Refresh server-rendered rental detail page so it shows updated status
      router.refresh();
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

export interface CancelRentalVariables {
  rentalId: string;
  reason: string;
}

/**
 * Hook for canceling a rental request or approved rental.
 * Pending: no refund. Approved: may include refundAmount and ownerTransferAmount.
 * Requires reason (1–1000 chars) for cancellation notes.
 */
export function useCancelRentalRequest() {
  const queryClient = useQueryClient();

  return useCreateMutation<CancelRentalResponse, CancelRentalVariables>({
    mutationFn: async ({ rentalId, reason }: CancelRentalVariables) => {
      const response = await fetch(`/api/rentals/${rentalId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const body: unknown = await response.json().catch(() => ({}));
      const messageFromBody = (): string => {
        if (
          body &&
          typeof body === "object" &&
          "error" in body &&
          typeof (body as { error?: unknown }).error === "string"
        ) {
          return (body as { error: string }).error;
        }
        return "Failed to cancel rental request";
      };

      if (!response.ok) {
        throw new Error(messageFromBody());
      }

      if (
        body &&
        typeof body === "object" &&
        "success" in body &&
        (body as { success?: boolean }).success === false
      ) {
        throw new Error(messageFromBody());
      }

      return body as CancelRentalResponse;
    },
    invalidateQueryKeys: [
      rentalKeys.all,
      rentalKeys.renting(),
      rentalKeys.lending(),
    ],
    onSuccess: (data, variables) => {
      const message =
        data.refundAmount != null
          ? `Rental cancelled successfully. A refund of $${data.refundAmount.toFixed(2)} has been processed.`
          : "Rental cancelled successfully";
      handleMutationSuccess(message);

      queryClient.invalidateQueries({
        queryKey: rentalKeys.detail(variables.rentalId),
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
