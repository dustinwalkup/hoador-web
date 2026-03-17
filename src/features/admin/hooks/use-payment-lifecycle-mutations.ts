import { useCreateMutation } from "@/lib/react-query/mutation-helpers";

const PAYMENT_LIFECYCLE_INVALIDATE_KEYS = [
  ["admin", "payment-lifecycle"],
  ["admin", "payment-lifecycle-detail"],
  ["admin", "payment-metrics"],
] as const;

export interface ResetPayoutStatusVariables {
  rentalId: string;
  reason?: string;
}

/**
 * Reset payout status from 'processing' or 'failed' to 'pending'. Requirements: 6.1
 */
export function useResetPayoutStatus() {
  return useCreateMutation({
    mutationFn: async ({ rentalId, reason }: ResetPayoutStatusVariables) => {
      const response = await fetch(
        `/api/admin/payments/lifecycle/${rentalId}/reset-payout-status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason ?? undefined }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reset payout status");
      }

      return response.json();
    },
    successMessage: "Payout status reset to pending",
    invalidateQueryKeys: [...PAYMENT_LIFECYCLE_INVALIDATE_KEYS],
  });
}

export interface ResetTransferStatusVariables {
  rentalId: string;
  reason?: string;
}

/**
 * Reset owner transfer status from 'failed' to 'pending'. Requirements: 7.1
 */
export function useResetTransferStatus() {
  return useCreateMutation({
    mutationFn: async ({ rentalId, reason }: ResetTransferStatusVariables) => {
      const response = await fetch(
        `/api/admin/payments/lifecycle/${rentalId}/reset-transfer-status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason ?? undefined }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reset transfer status");
      }

      return response.json();
    },
    successMessage: "Transfer status reset to pending",
    invalidateQueryKeys: [...PAYMENT_LIFECYCLE_INVALIDATE_KEYS],
  });
}

/**
 * Manually release deposit hold. Requirements: 8.1
 */
export function useReleaseDeposit() {
  return useCreateMutation({
    mutationFn: async (rentalId: string) => {
      const response = await fetch(
        `/api/admin/payments/lifecycle/${rentalId}/release-deposit`,
        { method: "POST" },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to release deposit");
      }

      return response.json();
    },
    successMessage: "Deposit released",
    invalidateQueryKeys: [...PAYMENT_LIFECYCLE_INVALIDATE_KEYS],
  });
}
