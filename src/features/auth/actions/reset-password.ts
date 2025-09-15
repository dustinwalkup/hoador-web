"use server";

import { redirect } from "next/navigation";
import { tryCatch } from "@walkup/walkup-utils";
import { auth } from "@/services/better-auth";
import { resetPasswordSchema } from "../schemas/password";

type ResetPasswordResult = {
  success: boolean;
  error?: string;
  redirect?: boolean;
};

export async function resetPasswordAction(
  prevState: ResetPasswordResult | null,
  formData: FormData,
): Promise<ResetPasswordResult> {
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;

  // Validate input
  const validation = resetPasswordSchema.safeParse({ token, password });
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Invalid input",
    };
  }

  const { error } = await tryCatch(
    auth.api.resetPassword({
      body: {
        token: validation.data.token,
        newPassword: validation.data.password,
      },
    }),
  );

  if (error) {
    console.error("Reset password error:", error);

    // Handle specific error cases
    if (
      error.message?.includes("expired") ||
      error.message?.includes("invalid")
    ) {
      return {
        success: false,
        error:
          "This reset link has expired or is invalid. Please request a new one.",
      };
    }

    return {
      success: false,
      error: "Failed to reset password. Please try again.",
    };
  }

  // Redirect to login page on success
  redirect("/login?message=password-reset-success");
}
