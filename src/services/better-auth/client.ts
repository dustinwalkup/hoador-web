import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  // Optional: Add custom fetch configuration
  fetchOptions: {
    onError(context) {
      // Log client-side auth errors
      console.error("Auth client error:", context.error);
    },
    onRequest(context) {
      // Log auth requests in development
      if (process.env.NODE_ENV === "development") {
        console.log("Auth request:", context.url, context.method);
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
