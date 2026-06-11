"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import { useHandleApiRedirect } from "@/lib/api/redirect-handler";
import type { ApiResponseWithRedirect } from "@/lib/api/redirect-handler";
import { trackCompleteRegistration } from "@/lib/analytics/meta";

/**
 * Hook for user signup
 */
export function useSignup() {
  const handleRedirect = useHandleApiRedirect();

  return useCreateMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      legalAccepted?: boolean;
      tosAccepted?: boolean;
      privacyAccepted?: boolean;
    }) => {
      const formData = new FormData();
      formData.append("email", data.email);
      formData.append("password", data.password);
      formData.append("firstName", data.firstName);
      formData.append("lastName", data.lastName);
      if (data.legalAccepted !== undefined) {
        formData.append("legalAccepted", String(data.legalAccepted));
      }
      if (data.tosAccepted !== undefined) {
        formData.append("tosAccepted", String(data.tosAccepted));
      }
      if (data.privacyAccepted !== undefined) {
        formData.append("privacyAccepted", String(data.privacyAccepted));
      }

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to sign up");
      }

      return response.json() as Promise<
        ApiResponseWithRedirect & { userId?: string }
      >;
    },
    successMessage:
      "Account created successfully! Please check your email to verify your account.",
    onSuccess: (response) => {
      // `eventID = userId` so the server CAPI twin in /api/auth/signup dedupes
      // against this browser event in Meta Events Manager.
      trackCompleteRegistration({
        method: "email",
        eventID: response.userId,
      });
      handleRedirect(response);
    },
  });
}

/**
 * Hook for joining a community
 */
export function useJoinCommunity() {
  const handleRedirect = useHandleApiRedirect();

  return useCreateMutation({
    mutationFn: async (data: { joinCode: string }) => {
      const formData = new FormData();
      formData.append("joinCode", data.joinCode);

      const response = await fetch("/api/auth/join-community", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to join community");
      }

      return response.json() as Promise<ApiResponseWithRedirect>;
    },
    successMessage: "Successfully joined community!",
    onSuccess: (response) => {
      handleRedirect(response);
    },
  });
}

/**
 * Hook for selecting a primary community (canonical post-verification step).
 * Replaces the join-code flow as the default path; legacy `useJoinCommunity`
 * is preserved for private invite codes (R1.5).
 */
export function useSelectCommunity() {
  const queryClient = useQueryClient();
  const handleRedirect = useHandleApiRedirect();

  return useCreateMutation({
    mutationFn: async (data: { communityId: string }) => {
      const formData = new FormData();
      formData.append("communityId", data.communityId);

      const response = await fetch("/api/auth/select-community", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to select community");
      }

      return response.json() as Promise<ApiResponseWithRedirect>;
    },
    successMessage: "Community selected!",
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      handleRedirect(response);
    },
  });
}

/**
 * Hook for resending verification email
 */
export function useResendVerification() {
  return useCreateMutation({
    mutationFn: async (data: { email: string }) => {
      const formData = new FormData();
      formData.append("email", data.email);

      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to resend verification email");
      }

      const result = await response.json();
      return result;
    },
    successMessage: "Verification email sent! Please check your inbox.",
  });
}

/**
 * Hook for accepting legal documents (OAuth flow)
 */
export function useAcceptLegalDocuments() {
  const handleRedirect = useHandleApiRedirect();

  return useCreateMutation({
    mutationFn: async (data: {
      tosAccepted: boolean;
      privacyAccepted: boolean;
    }) => {
      const formData = new FormData();
      formData.append("tosAccepted", String(data.tosAccepted));
      formData.append("privacyAccepted", String(data.privacyAccepted));

      const response = await fetch("/api/auth/accept-legal-documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to accept legal documents");
      }

      return response.json() as Promise<
        ApiResponseWithRedirect & { isNewSignup?: boolean; userId?: string }
      >;
    },
    successMessage: "Legal documents accepted successfully!",
    onSuccess: (response) => {
      // Only fire CompleteRegistration on the Google new-signup transition.
      // Existing users re-accepting updated legal docs would otherwise be
      // counted as new registrations. The server CAPI twin in
      // /api/auth/accept-legal-documents shares this same gate, so both
      // halves either fire together (and Meta dedupes by event_id) or skip.
      if (response.isNewSignup) {
        trackCompleteRegistration({
          method: "google",
          eventID: response.userId,
        });
      }
      handleRedirect(response);
    },
  });
}

/**
 * Hook for forgot password
 */
export function useForgotPassword() {
  return useCreateMutation({
    mutationFn: async (data: { email: string }) => {
      const formData = new FormData();
      formData.append("email", data.email);

      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send password reset email");
      }

      const result = await response.json();
      return result;
    },
    successMessage:
      "If an account with that email exists, we've sent you a password reset link.",
  });
}

/**
 * Hook for resetting password
 */
export function useResetPassword() {
  const handleRedirect = useHandleApiRedirect();

  return useCreateMutation({
    mutationFn: async (data: { token: string; password: string }) => {
      const formData = new FormData();
      formData.append("token", data.token);
      formData.append("password", data.password);

      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reset password");
      }

      return response.json() as Promise<ApiResponseWithRedirect>;
    },
    successMessage: "Password reset successfully!",
    onSuccess: (response) => {
      handleRedirect(response);
    },
  });
}
