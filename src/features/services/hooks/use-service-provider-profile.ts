import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import type {
  ServiceListing,
  ServiceProviderProfile,
} from "@/db/schemas/services.schema";
import type { ServiceReviewWithReviewer } from "@/dal/service-review.dal";
import { serviceBookingsKeys } from "@/features/services/hooks/use-service-bookings";

/** React Query keys for public provider profile pages. */
export const serviceProviderKeys = {
  all: ["service-provider"] as const,
  profile: (userId: string) =>
    [...serviceProviderKeys.all, "profile", userId] as const,
};

/** GET /api/services/providers/[userId] response shape. */
export interface ServiceProviderPageData {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    createdAt: Date | string;
  };
  profile: ServiceProviderProfile | null;
  activeListings: ServiceListing[];
  reviewsReceived: ServiceReviewWithReviewer[];
}

/**
 * Provider profile, active listings, and reviews (GET /api/services/providers/[userId]).
 */
export function useProviderProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: serviceProviderKeys.profile(userId ?? ""),
    queryFn: async (): Promise<ServiceProviderPageData> => {
      const res = await fetch(`/api/services/providers/${userId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to load profile");
      }
      return res.json() as Promise<ServiceProviderPageData>;
    },
    enabled: Boolean(userId),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * PATCH /api/services/providers/[userId] — update bio (session user must match userId).
 */
export function useUpdateProviderBio(userId: string) {
  return useCreateMutation({
    mutationFn: async (body: { bio: string }) => {
      const res = await fetch(`/api/services/providers/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to update bio");
      }
      return data as { profile: ServiceProviderProfile };
    },
    invalidateQueryKeys: [serviceProviderKeys.profile(userId)],
    successMessage: "Profile updated.",
  });
}

export interface SubmitServiceReviewInput {
  bookingId: string;
  rating: number;
  comment?: string;
  /** When set, invalidates this provider’s profile cache after a successful review. */
  providerUserId?: string;
}

/**
 * POST /api/services/bookings/[id]/reviews
 */
export function useSubmitServiceReview() {
  const queryClient = useQueryClient();

  return useCreateMutation({
    mutationFn: async ({
      bookingId,
      rating,
      comment,
    }: SubmitServiceReviewInput) => {
      const res = await fetch(`/api/services/bookings/${bookingId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: comment?.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to submit review");
      }
      return data as { submitted: true };
    },
    invalidateQueryKeys: [serviceBookingsKeys.all],
    successMessage: "Thanks for your review.",
    onSuccess: async (_data, variables) => {
      if (variables.providerUserId) {
        await queryClient.invalidateQueries({
          queryKey: serviceProviderKeys.profile(variables.providerUserId),
        });
      }
    },
  });
}
