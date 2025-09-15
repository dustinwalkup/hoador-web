import { ErrorContext } from "better-auth/react";

export function handleBetterAuthSignInError(context: ErrorContext) {
  // If email not verified, redirect to verify email page
  if (context.error.code === "EMAIL_NOT_VERIFIED") {
    const requestBody = JSON.parse(context.request.body as string);
    const email = requestBody.email;

    window.location.href = `/verify-email?email=${encodeURIComponent(email)}`;
  }

  // Handle specific error cases
  if (context.error?.message?.includes("email not verified")) {
    // Redirect to email verification page
    window.location.href = "/auth/verify-email";
  }
}
