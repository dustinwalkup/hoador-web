"use client";

import { useCallback, useTransition, useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signInEmail, signInSocial } from "../utils";

// Types for better type safety
interface LoginFormState {
  error: string | null;
  success: boolean;
}

export function useLoginForm(callbackUrl: string) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);

  const togglePassword = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  // Server action for form submission
  const loginAction = useCallback(
    async (
      prevState: LoginFormState,
      formData: FormData,
    ): Promise<LoginFormState> => {
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;

      if (!email || !password) {
        return { error: "Email and password are required", success: false };
      }

      try {
        await signInEmail(email, password);

        // Success - redirect in a transition
        startTransition(() => {
          router.push(callbackUrl);
          router.refresh();
        });

        return { error: null, success: true };
      } catch (error) {
        let errorMessage = "Failed to sign in. Please try again.";

        if (error instanceof Error) {
          if (error.message?.includes("email not verified")) {
            errorMessage =
              "Please verify your email address before signing in. Check your inbox for a verification link.";
          } else if (
            error.message?.includes("invalid") ||
            error.message?.includes("credentials")
          ) {
            errorMessage = "Invalid email or password. Please try again.";
          }
        }

        return { error: errorMessage, success: false };
      }
    },
    [callbackUrl, router],
  );

  const [state, formAction] = useActionState(loginAction, {
    error: null,
    success: false,
  });

  const handleSocialSignIn = useCallback(async (provider: "google") => {
    startTransition(async () => {
      try {
        await signInSocial(provider);
        toast.success("Redirecting to Google...");
      } catch (error) {
        toast.error("Failed to sign in with Google. Please try again.");
      }
    });
  }, []);

  const handleGoogleSignIn = useCallback(() => {
    handleSocialSignIn("google");
  }, [handleSocialSignIn]);

  return {
    // Form state
    state,
    formAction,
    isPending,

    // Password visibility
    showPassword,
    togglePassword,

    // Social login
    handleGoogleSignIn,
  };
}
