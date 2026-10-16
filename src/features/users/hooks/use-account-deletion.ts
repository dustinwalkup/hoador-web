"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { AccountDeletionBlocker } from "@/features/users/lib/account-deletion-errors";

export const deletionBlockersQueryKey = [
  "users",
  "me",
  "deletion-blockers",
] as const;

/**
 * What would block the current user's self-deletion right now
 * (`GET /api/users/me/deletion-blockers`). Read before the confirm form so
 * nobody types DELETE only to be told no. A courtesy: the DELETE re-checks.
 */
export function useDeletionBlockers() {
  return useQuery<AccountDeletionBlocker[]>({
    queryKey: deletionBlockersQueryKey,
    queryFn: async () => {
      const response = await fetch("/api/users/me/deletion-blockers");
      if (!response.ok) {
        throw new Error("Failed to check whether your account can be deleted");
      }
      const body = (await response.json()) as {
        blockers: AccountDeletionBlocker[];
      };
      return body.blockers;
    },
    // Always current: a blocker resolved a minute ago must not still show.
    staleTime: 0,
  });
}

/** How a `DELETE /api/users/me` attempt ended. */
export type DeleteAccountResult =
  | { status: "deleted" }
  | { status: "blocked"; blockers: AccountDeletionBlocker[] };

/**
 * Delete the current user's account (`DELETE /api/users/me`). A 409 comes back
 * as `blocked` with the fresh blockers rather than as an error: it's an
 * expected outcome, and the page shows the list instead of a toast. Anything
 * else rejects, and the caller shows its own message.
 */
export function useDeleteAccount() {
  return useMutation<DeleteAccountResult>({
    mutationFn: async () => {
      const response = await fetch("/api/users/me", { method: "DELETE" });
      if (response.ok) return { status: "deleted" };

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        blockers?: AccountDeletionBlocker[];
      };
      if (
        response.status === 409 &&
        body.error === "ACCOUNT_DELETION_BLOCKED"
      ) {
        return { status: "blocked", blockers: body.blockers ?? [] };
      }
      throw new Error(`Account deletion failed (${response.status})`);
    },
  });
}
