import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  RentalRequestItem,
  LendingRequestItem,
  RentalDetails,
  BorrowedListing,
} from "@/dal/rentals.dal";

// Query keys for consistent caching
export const rentalKeys = {
  all: ["rentals"] as const,
  renting: () => [...rentalKeys.all, "renting"] as const,
  rentingByStatus: (status: string) =>
    [...rentalKeys.renting(), status] as const,
  lending: () => [...rentalKeys.all, "lending"] as const,
  lendingByStatus: (status: string) =>
    [...rentalKeys.lending(), status] as const,
  detail: (id: string) => [...rentalKeys.all, "detail", id] as const,
};

// Renting hooks
export function useRentingRequests(
  status: "pending" | "approved" | "denied" | "cancelled" = "pending",
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: rentalKeys.rentingByStatus(`requests-${status}`),
    queryFn: async (): Promise<RentalRequestItem[]> => {
      const response = await fetch(
        `/api/rentals/renting/requests?status=${status}`,
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch renting requests");
      }
      const result = await response.json();
      return result.data;
    },
    staleTime: 1 * 60 * 1000, // 1 minute - user's own data
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
}

export function useRentingActive(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: rentalKeys.rentingByStatus("active"),
    queryFn: async (): Promise<BorrowedListing[]> => {
      const response = await fetch("/api/rentals/renting/active");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch active rentals");
      }
      const result = await response.json();
      return result.data;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
}

export function useRentingCompleted(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: rentalKeys.rentingByStatus("completed"),
    queryFn: async (): Promise<BorrowedListing[]> => {
      const response = await fetch("/api/rentals/renting/completed");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch completed rentals");
      }
      const result = await response.json();
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - completed data changes less
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
}

// Lending hooks
export function useLendingRequests(
  status:
    | "pending"
    | "approved"
    | "denied"
    | "active"
    | "completed"
    | "cancelled" = "pending",
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: rentalKeys.lendingByStatus(`requests-${status}`),
    queryFn: async (): Promise<LendingRequestItem[]> => {
      const response = await fetch(
        `/api/rentals/lending/incoming?status=${status}`,
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch lending requests");
      }
      const result = await response.json();
      return result.data;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
}

export function useLendingApproved(options?: { enabled?: boolean }) {
  return useLendingRequests("approved", options);
}

// Convenience hooks for specific lending statuses
export function useLendingIncoming(options?: { enabled?: boolean }) {
  return useLendingRequests("pending", options);
}

export function useLendingDenied(options?: { enabled?: boolean }) {
  return useLendingRequests("denied", options);
}

export function useLendingActive(options?: { enabled?: boolean }) {
  return useLendingRequests("active", options);
}

export function useLendingCompleted(options?: { enabled?: boolean }) {
  return useLendingRequests("completed", options);
}

export function useRentingCancelled(options?: { enabled?: boolean }) {
  return useRentingRequests("cancelled", options);
}

export function useLendingCancelled(options?: { enabled?: boolean }) {
  return useLendingRequests("cancelled", options);
}

// Individual rental details
export function useRentalDetails(rentalId: string | null) {
  return useQuery({
    queryKey: rentalKeys.detail(rentalId || ""),
    queryFn: async (): Promise<RentalDetails> => {
      if (!rentalId) throw new Error("Rental ID is required");
      const response = await fetch(`/api/rentals/${rentalId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch rental details");
      }
      return await response.json();
    },
    enabled: !!rentalId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
}

// Prefetching hook
export function usePrefetchRental() {
  const queryClient = useQueryClient();

  return (rentalId: string) => {
    queryClient.prefetchQuery({
      queryKey: rentalKeys.detail(rentalId),
      queryFn: async () => {
        const response = await fetch(`/api/rentals/${rentalId}`);
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch rental details");
        }
        return await response.json();
      },
      staleTime: 2 * 60 * 1000,
    });
  };
}

// Utility hook for getting all renting data at once (for tab switching)
export function useAllRentingData() {
  const requests = useRentingRequests("pending");
  const approved = useRentingRequests("approved");
  const denied = useRentingRequests("denied");
  const cancelled = useRentingCancelled();
  const active = useRentingActive();
  const completed = useRentingCompleted();

  return {
    requests,
    approved,
    denied,
    cancelled,
    active,
    completed,
    isLoading:
      requests.isLoading ||
      approved.isLoading ||
      denied.isLoading ||
      cancelled.isLoading ||
      active.isLoading ||
      completed.isLoading,
    hasError:
      requests.error ||
      approved.error ||
      denied.error ||
      cancelled.error ||
      active.error ||
      completed.error,
  };
}

// Utility hook for getting all lending data at once (for tab switching)
export function useAllLendingData() {
  const incoming = useLendingIncoming();
  const approved = useLendingApproved();
  const denied = useLendingDenied();
  const cancelled = useLendingCancelled();
  const active = useLendingActive();
  const completed = useLendingCompleted();

  return {
    incoming,
    approved,
    denied,
    cancelled,
    active,
    completed,
    isLoading:
      incoming.isLoading ||
      approved.isLoading ||
      denied.isLoading ||
      cancelled.isLoading ||
      active.isLoading ||
      completed.isLoading,
    hasError:
      incoming.error ||
      approved.error ||
      denied.error ||
      cancelled.error ||
      active.error ||
      completed.error,
  };
}
