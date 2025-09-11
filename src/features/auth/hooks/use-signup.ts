"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signupEmailAction } from "../actions/signup-email.action";
import { validateJoinCodeAction } from "../actions/validate-join-code.action";
import { completeOnboardingAction } from "../actions/complete-onboarding.action";
import {
  type CompleteEmailSignupInput,
  type OnboardingInput,
} from "../form-schema/signup-schema";

/**
 * Hook for managing email signup flow
 * Handles form state, validation, and server actions
 */
export function useSignup() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [currentStep, setCurrentStep] = useState<
    "joinCode" | "profile" | "onboarding"
  >("joinCode");
  const [formData, setFormData] = useState<{
    joinCode?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    unit?: string;
    bio?: string;
    profileImageUrl?: string;
  }>({});

  // Community validation state
  const [community, setCommunity] = useState<{
    id: string;
    name: string;
    imageUrl: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  } | null>(null);

  // Validation state
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  /**
   * Validate join code and proceed to next step
   */
  const validateJoinCode = async (joinCode: string) => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("joinCode", joinCode);

        const result = await validateJoinCodeAction(
          { success: false },
          formData,
        );

        if (result.success && result.community) {
          setCommunity(result.community);
          setFormData((prev) => ({ ...prev, joinCode }));
          setCurrentStep("profile");
          setValidationErrors({});

          toast.success(`Welcome to ${result.community.name}!`);
        } else {
          setValidationErrors({
            joinCode: result.error || "Invalid join code",
          });
          toast.error(result.error || "Please check and try again.");
        }
      } catch (error) {
        console.error("Join code validation error:", error);
        toast.error("Failed to validate join code. Please try again.");
      }
    });
  };

  /**
   * Complete email signup with profile data
   */
  const completeEmailSignup = async (profileData: CompleteEmailSignupInput) => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("email", profileData.email);
        formData.append("password", profileData.password);
        formData.append("confirmPassword", profileData.confirmPassword);
        formData.append("firstName", profileData.firstName);
        formData.append("lastName", profileData.lastName);
        formData.append("phone", profileData.phone);
        formData.append("street", profileData.street);
        formData.append("city", profileData.city);
        formData.append("state", profileData.state);
        formData.append("zipCode", profileData.zipCode);
        formData.append("unit", profileData.unit || "");
        formData.append("joinCode", formData.get("joinCode") as string);

        const result = await signupEmailAction({ success: false }, formData);

        if (result.success) {
          setFormData((prev) => ({ ...prev, ...profileData }));

          if (result.requiresVerification) {
            toast.success(
              "Account created! Please check your email to verify your account.",
            );
            // Redirect to verification page
            router.push("/auth/verify-email");
          } else {
            // Account fully set up - redirect to dashboard
            router.push("/dashboard");
          }
        } else {
          setValidationErrors({ general: result.error || "Signup failed" });
          toast.error(result.error || "Please try again.");
        }
      } catch (error) {
        console.error("Email signup error:", error);
        toast.error("Failed to create account. Please try again.");
      }
    });
  };

  /**
   * Complete onboarding after email verification
   */
  const completeOnboarding = async (onboardingData: OnboardingInput) => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        if (onboardingData.bio) formData.append("bio", onboardingData.bio);
        if (onboardingData.profileImageUrl)
          formData.append("profileImageUrl", onboardingData.profileImageUrl);

        const result = await completeOnboardingAction(
          { success: false },
          formData,
        );

        if (result.success) {
          toast.success("Profile complete! Welcome to Hoador!");
          router.push("/dashboard");
        } else {
          setValidationErrors({ general: result.error || "Onboarding failed" });
          toast.error(result.error || "Please try again.");
        }
      } catch (error) {
        console.error("Onboarding error:", error);
        toast.error("Failed to complete onboarding. Please try again.");
      }
    });
  };

  /**
   * Go back to previous step
   */
  const goBack = () => {
    if (currentStep === "profile") {
      setCurrentStep("joinCode");
      setCommunity(null);
      setFormData((prev) => ({ joinCode: prev.joinCode }));
    } else if (currentStep === "onboarding") {
      setCurrentStep("profile");
    }
    setValidationErrors({});
  };

  /**
   * Reset form and start over
   */
  const reset = () => {
    setCurrentStep("joinCode");
    setFormData({});
    setCommunity(null);
    setValidationErrors({});
  };

  /**
   * Update form data
   */
  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    // Clear validation errors for updated fields
    const clearedErrors = { ...validationErrors };
    Object.keys(updates).forEach((key) => {
      delete clearedErrors[key];
    });
    setValidationErrors(clearedErrors);
  };

  /**
   * Set validation errors
   */
  const setErrors = (errors: Record<string, string>) => {
    setValidationErrors(errors);
  };

  return {
    // State
    currentStep,
    formData,
    community,
    validationErrors,
    isPending,

    // Actions
    validateJoinCode,
    completeEmailSignup,
    completeOnboarding,
    goBack,
    reset,
    updateFormData,
    setErrors,

    // Helpers
    canGoBack: currentStep !== "joinCode",
    isJoinCodeValid: !!community,
    isProfileComplete: !!(
      formData.email &&
      formData.password &&
      formData.firstName &&
      formData.lastName &&
      formData.phone &&
      formData.street &&
      formData.city &&
      formData.state &&
      formData.zipCode
    ),
  };
}
