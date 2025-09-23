"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { auth } from "@/services/better-auth";

type VerifyEmailResult = {
  success: boolean;
  error?: string;
  message?: string;
};

export async function resendVerificationEmailAction(
  prevState: VerifyEmailResult | null,
  formData: FormData,
): Promise<VerifyEmailResult> {
  const email = formData.get("email") as string;

  if (!email) {
    return {
      success: false,
      error: "Email address is required.",
    };
  }

  // Use Better Auth to resend verification email
  const { error } = await tryCatch(
    auth.api.sendVerificationEmail({
      body: {
        email,
        callbackURL: "/signup/email/callback",
      },
    }),
  );

  if (error) {
    console.error("Resend verification email error:", error);

    if (error.message?.includes("already verified")) {
      return {
        success: false,
        error: "This email address is already verified.",
      };
    }

    if (error.message?.includes("not found")) {
      return {
        success: false,
        error: "No account found with this email address.",
      };
    }

    if (
      error.message?.includes("rate limit") ||
      error.message?.includes("wait")
    ) {
      return {
        success: false,
        error: "Please wait before requesting another verification email.",
      };
    }

    return {
      success: false,
      error: "Failed to send verification email. Please try again.",
    };
  }

  return {
    success: true,
    message: "Verification email sent! Please check your inbox.",
  };
}
