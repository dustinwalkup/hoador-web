import { useQuery } from "@tanstack/react-query";
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";

/**
 * Hook for fetching account session client secret for Stripe Connect
 * Account sessions are reusable, so we cache them for 5 minutes
 */
export function useAccountSession(
  mode: "payments" | "onboarding" = "onboarding",
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ["account-session", mode],
    queryFn: async (): Promise<string> => {
      const response = await fetch(
        `/api/stripe/create-account-session?mode=${mode}`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        let errorMessage = error.error || "Failed to create account session";

        // Provide user-friendly messages for specific error cases
        if (response.status === 401) {
          errorMessage = "Please sign in to access payment settings.";
        } else if (response.status === 404) {
          errorMessage =
            "Payment account not found. Please complete onboarding.";
        } else if (response.status >= 500) {
          errorMessage = "Server error. Please try again later.";
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!data.clientSecret) {
        throw new Error("Invalid response from server");
      }

      return data.clientSecret;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - account sessions are reusable
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for creating a login link for Express Dashboard access
 * Opens the URL in a new window on success
 */
export function useCreateLoginLink() {
  return useCreateMutation<string, void>({
    mutationFn: async (): Promise<string> => {
      const response = await fetch("/api/stripe/create-login-link", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error || `Failed to create login link (${response.status})`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!data.url) {
        throw new Error("Invalid response from server");
      }

      return data.url;
    },
    // No success message - opens URL directly
    // No invalidations needed - just opens URL
    onSuccess: (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
  });
}
