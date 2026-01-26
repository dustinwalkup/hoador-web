import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import { disputeKeys } from "./use-disputes";
import type { DisputeStatus } from "@/dal/types";

export interface UpdateDisputeStateData {
  newState: DisputeStatus;
  reason?: string;
}

/**
 * Hook for updating dispute state (admin only for most transitions)
 */
export function useUpdateDisputeState(disputeId: string) {
  return useCreateMutation({
    mutationFn: async (data: UpdateDisputeStateData) => {
      const response = await fetch(`/api/disputes/${disputeId}/state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update dispute state");
      }

      return response.json();
    },
    successMessage: "Dispute state updated successfully",
    invalidateQueryKeys: [disputeKeys.detail(disputeId)],
  });
}
