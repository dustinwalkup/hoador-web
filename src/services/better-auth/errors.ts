import { ErrorContext } from "better-auth/react";
import * as Sentry from "@sentry/nextjs";

import { toError } from "@/lib/sentry/to-error";

export function handleBetterAuthSignInError(context: ErrorContext) {
  // Only capture unexpected auth errors in production
  const isUnexpectedError =
    process.env.NODE_ENV === "production" &&
    context.error.code !== "EMAIL_NOT_VERIFIED";

  if (isUnexpectedError) {
    const fallback = context.error?.code
      ? `Auth error: ${context.error.code}`
      : "Auth error";
    Sentry.captureException(toError(context.error, fallback), {
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
    let email: string | undefined;
    try {
      const body =
        typeof context.request?.body === "string"
          ? context.request.body
          : undefined;
      const requestBody = body
        ? (JSON.parse(body) as { email?: string })
        : null;
      email = requestBody?.email;
    } catch {
      email = undefined;
    }
    const query = email ? `?email=${encodeURIComponent(email)}` : "";
    window.location.href = `/verify-email${query}`;
  }

  // Handle specific error cases
  if (context.error?.message?.includes("email not verified")) {
    window.location.href = "/verify-email";
  }
}
