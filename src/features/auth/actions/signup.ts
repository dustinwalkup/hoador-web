"use server";

import { redirect } from "next/navigation";
import { tryCatch } from "@walkup/walkup-utils";
import { auth } from "@/services/better-auth";
import { emailSignupSchema } from "../schemas/auth-schemas";

type SignupResult = {
  success: boolean;
  error?: string;
};

export async function signupAction(
  prevState: SignupResult | null,
  formData: FormData,
): Promise<SignupResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;

  // Validate form data
  const signupData = { email, password, firstName, lastName };

  try {
    emailSignupSchema.parse(signupData);
  } catch {
    return {
      success: false,
      error: "Please check your information and try again.",
    };
  }

  // Create account with Better Auth
  const { data: authResult, error: authError } = await tryCatch(
    auth.api.signUpEmail({
      body: {
        email,
        password,
        name: `${firstName} ${lastName}`,
      },
    }),
  );

  if (authError) {
    console.error("Better Auth signup error:", authError);

    if (authError.message?.includes("already exists")) {
      return {
        success: false,
        error:
          "An account with this email already exists. Please sign in instead.",
      };
    }

    return {
      success: false,
      error: "Failed to create account. Please try again.",
    };
  }

  if (!authResult?.user) {
    return {
      success: false,
      error: "Failed to create account. Please try again.",
    };
  }

  // Success! Better Auth handles user creation completely
  // Redirect to verify email with email parameter
  redirect(`/verify-email?email=${encodeURIComponent(email)}`);
}
