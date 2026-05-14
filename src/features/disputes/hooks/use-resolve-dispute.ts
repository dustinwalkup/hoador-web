import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import { disputeKeys } from "./use-disputes";
import type {
  DisputeResolutionOutcome,
  FinancialOperationType,
} from "@/dal/types";

export interface FinancialOperation {
  type: FinancialOperationType;
  amount?: number;
}

export interface ResolveDisputeData {
  outcome: DisputeResolutionOutcome;
  reason: string;
  financialOperations?: FinancialOperation[];
}

/**
 * Hook for resolving a dispute (admin only)
 * Executes financial operations and marks dispute as resolved
 */
export function useResolveDispute(disputeId: string) {
  return useCreateMutation({
    mutationFn: async (data: ResolveDisputeData) => {
      const response = await fetch(`/api/disputes/${disputeId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to resolve dispute");
      }

      return response.json();
    },
    successMessage: "Dispute resolved successfully",
    invalidateQueryKeys: [
      disputeKeys.detail(disputeId),
      disputeKeys.all,
      ["admin", "badges"],
    ],
  });
}
