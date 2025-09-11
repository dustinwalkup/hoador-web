import { createAuthClient } from "better-auth/react";
import type { User } from "./index";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  // Optional: Add custom fetch configuration
  fetchOptions: {
    onError(context) {
      // Log client-side auth errors
      console.error("Auth client error:", context.error);

      // Handle specific error cases
      if (context.error?.message?.includes("email not verified")) {
        // Redirect to email verification page
        window.location.href = "/auth/verify-email";
      }
    },
    onRequest(context) {
      // Log auth requests in development
      if (process.env.NODE_ENV === "development") {
        console.log("Auth request:", context.url, context.method);
      }
    },
    onSuccess(context) {
      // Log successful auth actions in development
      if (process.env.NODE_ENV === "development") {
        console.log("Auth success:", context.data);
      }
    },
  },
});

// Export commonly used hooks for convenience
export const {
  signUp,
  signIn,
  signOut,
  useSession,
  getSession,
  updateUser,
  resetPassword,
  forgetPassword,
  verifyEmail,
} = authClient;

// Export types for convenience
export type { User };
