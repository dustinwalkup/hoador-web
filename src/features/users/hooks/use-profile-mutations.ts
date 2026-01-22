import { useQueryClient } from "@tanstack/react-query";
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";

export type UpdateUserProfileData = {
  firstName: string;
  lastName: string;
  email: string;
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
 * Hook for updating user profile and address
 * Invalidates profile and user queries on success
 */
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

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
    invalidateQueryKeys: [["profile"], ["user"]],
    onSuccess: () => {
      // Invalidate all profile-related queries
      queryClient.invalidateQueries({
        queryKey: ["profile"],
      });
      queryClient.invalidateQueries({
        queryKey: ["user"],
      });
    },
  });
}
