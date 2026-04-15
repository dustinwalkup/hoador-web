import { useRouter } from "next/navigation";
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import { disputeKeys } from "./use-disputes";
import type { DisputeReasonCode } from "@/dal/types";

export interface CreateDisputeData {
  rentalId?: string;
  serviceBookingId?: string;
  reasonCode: DisputeReasonCode;
  description: string;
}

/**
 * Hook for creating a new dispute (rental or service booking).
 */
export function useCreateDispute() {
  const router = useRouter();

  return useCreateMutation({
    mutationFn: async (data: CreateDisputeData) => {
      const response = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create dispute");
      }

      return response.json();
    },
    successMessage: "Dispute created successfully",
    invalidateQueryKeys: [disputeKeys.all],
    onSuccess: (responseData) => {
      if (responseData?.id) {
        router.push(`/dashboard/disputes/${responseData.id}`);
      }
    },
  });
}
