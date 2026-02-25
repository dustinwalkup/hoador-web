"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { OnboardingData } from "../schemas/validation";

type OnboardingResponse = {
  success: boolean;
  error?: string;
  warning?: string;
  redirect?: string;
  data?: {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  };
};

/**
 * React Query hook for completing user onboarding
 */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: OnboardingData): Promise<OnboardingResponse> => {
      // Convert data to FormData
      const formData = new FormData();
      formData.append("firstName", data.firstName);
      formData.append("lastName", data.lastName);
      formData.append("phone", data.phone);
      if (data.bio) {
        formData.append("bio", data.bio);
      }
      if (data.profileImageUrl) {
        formData.append("profileImageUrl", data.profileImageUrl);
      }
      formData.append("street", data.address.street);
      formData.append("city", data.address.city);
      formData.append("state", data.address.state);
      formData.append("zipCode", data.address.zipCode);

      const response = await fetch("/api/onboarding", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to complete onboarding");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate user-related queries
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });

      // Show success message
      if (data.warning) {
        toast.warning("Profile Updated", {
          description: data.warning,
        });
      } else {
        toast.success("Profile completed successfully");
      }

      // Handle redirect
      if (data.redirect) {
        router.push(data.redirect);
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to complete onboarding", {
        description: error.message || "Please try again",
      });
    },
  });
}
