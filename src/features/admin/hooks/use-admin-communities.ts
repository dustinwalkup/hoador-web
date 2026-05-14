"use client";

import { useQuery } from "@tanstack/react-query";
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import type { PaginatedResult } from "@/dal/types";
import type {
  Community,
  CommunityWithStats,
  CommunityNetwork,
} from "@/db/schemas/communities.schema";

const ADMIN_COMMUNITIES_KEY = ["admin", "communities"] as const;

export type AdminCommunitiesResponse = PaginatedResult<
  Community | CommunityWithStats
>;

/** Fields the admin community editor can create / update. */
export type CommunityFormValues = {
  name: string;
  imageUrl?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  isActive: boolean;
  networkId: string | null;
};

/** Paginated list of communities for the admin CRUD table. */
export function useAdminCommunities({
  page = 1,
  limit = 25,
  includeStats = true,
}: { page?: number; limit?: number; includeStats?: boolean } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (includeStats) params.set("includeStats", "true");

  return useQuery<AdminCommunitiesResponse>({
    queryKey: [...ADMIN_COMMUNITIES_KEY, page, limit, includeStats],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/communities?${params.toString()}`,
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to load communities");
      }
      return response.json();
    },
    staleTime: 30 * 1000,
  });
}

/** All community networks — populates the network dropdown in the editor. */
export function useAdminNetworks() {
  return useQuery<CommunityNetwork[]>({
    queryKey: ["admin", "networks"],
    queryFn: async () => {
      const response = await fetch("/api/admin/networks");
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to load networks");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Create a community. */
export function useCreateCommunity() {
  return useCreateMutation({
    mutationFn: async (values: CommunityFormValues) => {
      const response = await fetch("/api/admin/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create community");
      }
      return response.json();
    },
    successMessage: "Community created",
    invalidateQueryKeys: [ADMIN_COMMUNITIES_KEY],
  });
}

/** Update a community. */
export function useUpdateCommunity() {
  return useCreateMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: Partial<CommunityFormValues>;
    }) => {
      const response = await fetch(`/api/admin/communities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update community");
      }
      return response.json();
    },
    successMessage: "Community updated",
    invalidateQueryKeys: [ADMIN_COMMUNITIES_KEY],
  });
}
