import { ErrorContext } from "better-auth/react";
import * as Sentry from "@sentry/nextjs";

export function handleBetterAuthSignInError(context: ErrorContext) {
  // Only capture unexpected auth errors in production
  const isUnexpectedError =
    process.env.NODE_ENV === "production" &&
    context.error.code !== "EMAIL_NOT_VERIFIED";

  if (isUnexpectedError) {
    Sentry.captureException(context.error, {
      tags: {
        error_type: "auth_error",
        error_code: context.error.code,
      },
      contexts: {
        auth: {
          code: context.error.code,
          message: context.error.message,
        },
      },
    });
  }

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
