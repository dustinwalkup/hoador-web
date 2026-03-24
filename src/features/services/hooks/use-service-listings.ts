import { useQuery } from "@tanstack/react-query";
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import type {
  ServiceListingBrowseItem,
  ServiceListingWithCategoryAndProvider,
} from "@/dal/service-listing.dal";
import type { ServiceListing } from "@/db/schemas/services.schema";
import type { CreateListingInput } from "@/features/services/types";

/** React Query keys for HOA service listings (client cache). */
export const serviceListingsKeys = {
  all: ["service-listings"] as const,
  list: (communityId: string, filters?: { categoryId?: string }) =>
    [...serviceListingsKeys.all, "list", communityId, filters ?? {}] as const,
  detail: (listingId: string) =>
    [...serviceListingsKeys.all, "detail", listingId] as const,
};

/**
 * Active listings for the signed-in user's community (GET /api/services/listings).
 *
 * @param communityId - Used for cache scoping (must match session community for correct data)
 * @param filters - Optional category filter
 */
export function useServiceListings(
  communityId: string | null | undefined,
  filters?: { categoryId?: string },
) {
  return useQuery({
    queryKey: serviceListingsKeys.list(communityId ?? "", filters),
    queryFn: async (): Promise<ServiceListingBrowseItem[]> => {
      const params = new URLSearchParams();
      if (filters?.categoryId) {
        params.set("categoryId", filters.categoryId);
      }
      const res = await fetch(`/api/services/listings?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to load listings");
      }
      const data = (await res.json()) as {
        listings: ServiceListingBrowseItem[];
      };
      return data.listings ?? [];
    },
    enabled: Boolean(communityId),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Single listing detail (GET /api/services/listings/[id]).
 */
export function useServiceListing(listingId: string | null | undefined) {
  return useQuery({
    queryKey: serviceListingsKeys.detail(listingId ?? ""),
    queryFn: async (): Promise<ServiceListingWithCategoryAndProvider> => {
      const res = await fetch(`/api/services/listings/${listingId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to load listing");
      }
      return res.json() as Promise<ServiceListingWithCategoryAndProvider>;
    },
    enabled: Boolean(listingId),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * POST /api/services/listings — create listing (pending approval).
 */
export function useCreateServiceListing() {
  return useCreateMutation({
    mutationFn: async (input: CreateListingInput) => {
      const res = await fetch("/api/services/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create listing");
      }
      return data as { listingId: string; status: string };
    },
    invalidateQueryKeys: [serviceListingsKeys.all],
    successMessage:
      "Your listing has been submitted for review. You'll be notified when it's approved.",
  });
}

/**
 * PATCH /api/services/listings/[id]
 */
export function useEditServiceListing(listingId: string) {
  return useCreateMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/services/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to update listing");
      }
      return data;
    },
    invalidateQueryKeys: [serviceListingsKeys.all],
    successMessage: "Listing updated.",
  });
}

/** React Query keys for the signed-in user's own service listings. */
export const myServiceListingsKeys = {
  all: ["my-service-listings"] as const,
  byStatus: (status: string) => [...myServiceListingsKeys.all, status] as const,
};

/**
 * GET /api/services/listings/my?status= — provider's own listings by status.
 */
export function useMyServiceListings(status: string) {
  return useQuery({
    queryKey: myServiceListingsKeys.byStatus(status),
    queryFn: async (): Promise<ServiceListing[]> => {
      const res = await fetch(
        `/api/services/listings/my?status=${encodeURIComponent(status)}`,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? "Failed to load listings",
        );
      }
      const data = (await res.json()) as { listings: ServiceListing[] };
      return data.listings ?? [];
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Count of pending_approval listings (used for the tab badge).
 */
export function useMyPendingServiceListingsCount() {
  return useQuery({
    queryKey: myServiceListingsKeys.byStatus("pending_approval"),
    queryFn: async (): Promise<ServiceListing[]> => {
      const res = await fetch(
        `/api/services/listings/my?status=pending_approval`,
      );
      if (!res.ok) return [];
      const data = (await res.json()) as { listings: ServiceListing[] };
      return data.listings ?? [];
    },
    select: (data) => data.length,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * POST /api/services/listings/[id]/reactivate
 */
export function useReactivateServiceListing(listingId: string) {
  return useCreateMutation<{ status: "active" }, void>({
    mutationFn: async () => {
      const res = await fetch(
        `/api/services/listings/${listingId}/reactivate`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error ?? "Failed to reactivate listing",
        );
      }
      return data as { status: "active" };
    },
    invalidateQueryKeys: [serviceListingsKeys.all, myServiceListingsKeys.all],
    successMessage: "Listing reactivated.",
  });
}

/**
 * POST /api/services/listings/[id]/deactivate
 */
export function useDeactivateServiceListing(listingId: string) {
  return useCreateMutation<{ status: "inactive" }, void>({
    mutationFn: async () => {
      const res = await fetch(
        `/api/services/listings/${listingId}/deactivate`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to deactivate listing");
      }
      return data as { status: "inactive" };
    },
    invalidateQueryKeys: [serviceListingsKeys.all, myServiceListingsKeys.all],
    successMessage: "Listing deactivated.",
  });
}
