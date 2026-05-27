import { useQuery } from "@tanstack/react-query";
import type { UserProfile } from "@/dal/types";

/** Canonical query key for the current user's profile. */
export const profileQueryKey = ["profile"] as const;

/**
 * Subscribes to the current user's profile, hydrated from `initialData` that
 * the parent (typically a Server Component) fetched at request time. Profile
 * mutations invalidate this key, so any client component using this hook
 * re-renders automatically after an edit — no `router.refresh()` round-trip
 * to re-execute the server component.
 */
export function useProfile(initialData: UserProfile) {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: async (): Promise<UserProfile> => {
      const response = await fetch("/api/profile");
      if (!response.ok) {
        throw new Error("Failed to fetch profile");
      }
      return response.json();
    },
    initialData,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
