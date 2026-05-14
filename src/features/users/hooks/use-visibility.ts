"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import type { Community } from "@/db/schemas/communities.schema";

/** One row of the current user's community-visibility list. */
export type VisibilityRow = {
  community: Community;
  isVisible: boolean;
  /** True for the home community — locked visible in the settings UI. */
  isPrimary: boolean;
};

/** A single visibility change submitted by {@link useUpdateVisibility}. */
export type VisibilityUpdate = {
  communityId: string;
  isVisible: boolean;
};

export const visibilityQueryKey = ["users", "me", "visibility"] as const;

/**
 * Fetch the current user's per-community visibility list — every community in
 * their network, flagged visible or hidden — joined with community info.
 */
export function useVisibility() {
  return useQuery<VisibilityRow[]>({
    queryKey: visibilityQueryKey,
    queryFn: async () => {
      const response = await fetch("/api/users/me/visibility");
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to load visibility settings");
      }
      return response.json();
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Bulk-update the current user's community visibility.
 * Rejects (400) any attempt to hide the primary community.
 * Invalidates the visibility query and downstream listing-search caches so the
 * feed reflects the change without a manual refresh.
 */
export function useUpdateVisibility() {
  const queryClient = useQueryClient();

  return useCreateMutation({
    mutationFn: async (updates: VisibilityUpdate[]) => {
      const response = await fetch("/api/users/me/visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to update visibility settings");
      }
      return response.json();
    },
    successMessage: "Visibility updated",
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: visibilityQueryKey });
      // The listing feed is downstream of visibility; refresh both flavours.
      queryClient.invalidateQueries({ queryKey: ["search-listings"] });
      queryClient.invalidateQueries({ queryKey: ["service-listings"] });
    },
  });
}
