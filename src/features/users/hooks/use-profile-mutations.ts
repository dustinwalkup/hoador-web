import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import { profileQueryKey } from "./use-profile";

export type UpdateUserProfileData = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  bio?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
};

/**
 * Hook for updating user profile and address.
 * Invalidates the canonical ["profile"] key so any client component using
 * `useProfile()` re-fetches and re-renders automatically.
 */
export function useUpdateUserProfile() {
  return useCreateMutation({
    mutationFn: async (data: UpdateUserProfileData) => {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update profile");
      }

      return response.json();
    },
    successMessage: "Profile updated successfully",
    invalidateQueryKeys: [[...profileQueryKey]],
  });
}

/**
 * Hook for updating profile image URL.
 * Invalidates the canonical ["profile"] key — see `useUpdateUserProfile`.
 */
export function useUpdateProfileImage() {
  return useCreateMutation({
    mutationFn: async (profileImageUrl: string) => {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileImageUrl }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update profile image");
      }

      return response.json();
    },
    successMessage: "Profile image updated successfully",
    invalidateQueryKeys: [[...profileQueryKey]],
  });
}
