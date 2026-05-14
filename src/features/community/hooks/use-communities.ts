"use client";

import { useQuery } from "@tanstack/react-query";
import type { Community } from "@/db/schemas/communities.schema";
import { DEFAULT_NETWORK_SLUG } from "../constants";

/**
 * Fetch the active communities in a network, for the community-select dropdown.
 * Defaults to the canonical network ({@link DEFAULT_NETWORK_SLUG}).
 */
export function useCommunitiesByNetwork(
  networkSlug: string = DEFAULT_NETWORK_SLUG,
  { activeOnly = true }: { activeOnly?: boolean } = {},
) {
  const params = new URLSearchParams({ networkSlug });
  if (!activeOnly) params.set("active", "false");

  return useQuery<Community[]>({
    queryKey: ["communities", "by-network", networkSlug, activeOnly],
    queryFn: async () => {
      const response = await fetch(`/api/communities?${params.toString()}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to load communities");
      }
      return response.json();
    },
    staleTime: 60 * 1000,
  });
}
