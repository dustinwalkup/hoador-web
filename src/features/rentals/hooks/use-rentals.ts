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
export function useRentingRequests(status: "pending" | "denied" = "pending") {
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
  });
}

export function useRentingActive() {
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
  });
}

export function useRentingCompleted() {
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
  });
}

// Lending hooks
export function useLendingRequests(
  status: "pending" | "denied" | "active" | "completed" = "pending",
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
  });
}

// Convenience hooks for specific lending statuses
export function useLendingIncoming() {
  return useLendingRequests("pending");
}

export function useLendingDenied() {
  return useLendingRequests("denied");
}

export function useLendingActive() {
  return useLendingRequests("active");
}

export function useLendingCompleted() {
  return useLendingRequests("completed");
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
  const denied = useRentingRequests("denied");
  const active = useRentingActive();
  const completed = useRentingCompleted();

  return {
    requests,
    denied,
    active,
    completed,
    isLoading:
      requests.isLoading ||
      denied.isLoading ||
      active.isLoading ||
      completed.isLoading,
    hasError: requests.error || denied.error || active.error || completed.error,
  };
}

// Utility hook for getting all lending data at once (for tab switching)
export function useAllLendingData() {
  const incoming = useLendingIncoming();
  const denied = useLendingDenied();
  const active = useLendingActive();
  const completed = useLendingCompleted();

  return {
    incoming,
    denied,
    active,
    completed,
    isLoading:
      incoming.isLoading ||
      denied.isLoading ||
      active.isLoading ||
      completed.isLoading,
    hasError: incoming.error || denied.error || active.error || completed.error,
  };
}
