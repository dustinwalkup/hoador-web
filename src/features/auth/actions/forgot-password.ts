"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { auth } from "@/services/better-auth";
import { forgotPasswordSchema } from "../schemas/password";

type ForgotPasswordResult = {
  success: boolean;
  error?: string;
  message?: string;
};

export async function forgotPasswordAction(
  prevState: ForgotPasswordResult | null,
  formData: FormData,
): Promise<ForgotPasswordResult> {
  const email = formData.get("email") as string;

  // Validate input
  const validation = forgotPasswordSchema.safeParse({ email });
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Invalid email address",
    };
  }

  const { error } = await tryCatch(
    auth.api.requestPasswordReset({
      body: {
        email: validation.data.email,
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
      },
    }),
  );

  if (error) {
    console.error("Forgot password error:", error);
    return {
      success: false,
      error: "Failed to send reset email. Please try again.",
    };
  }

  return {
    success: true,
    message:
      "If an account with that email exists, we've sent you a password reset link.",
  };
}
