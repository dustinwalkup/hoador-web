import { createAuthClient } from "better-auth/react";
import type { User } from "./index";
import { handleBetterAuthSignInError } from "./errors";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",

  // Optional: Add custom fetch configuration
  fetchOptions: {
    onError: async (context) => {
      handleBetterAuthSignInError(context);
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
  requestPasswordReset,
  verifyEmail,
} = authClient;

// Export types for convenience
export type { User };
