"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/services/better-auth/client";
import {
  signupGoogleAction,
  completeGoogleSignupAfterOAuth,
} from "../actions/signup-google.action";
import { validateJoinCodeAction } from "../actions/validate-join-code.action";
import { completeOnboardingAction } from "../actions/complete-onboarding.action";
import {
  type CompleteGoogleSignupInput,
  type OnboardingInput,
} from "../form-schema/signup-schema";

/**
 * Google OAuth user data from Better Auth
 */
interface GoogleUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
}

/**
 * Hook for managing Google OAuth signup flow
 * Handles OAuth authentication, profile data parsing, and additional data collection
 */
export function useGoogleSignin() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [currentStep, setCurrentStep] = useState<
    "joinCode" | "oauth" | "profile" | "onboarding"
  >("joinCode");
  const [formData, setFormData] = useState<{
    joinCode?: string;
    googleUser?: GoogleUser;
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
   * Validate join code and proceed to OAuth step
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
          setCurrentStep("oauth");
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
   * Initiate Google OAuth signin
   */
  const initiateGoogleSignin = async () => {
    startTransition(async () => {
      try {
        // Use Better Auth Google signin
        const result = await authClient.signIn.social({
          provider: "google",
          callbackURL: "/auth/signup/google/callback",
        });

        if (result.error) {
          toast.error(result.error.message || "Please try again.");
        }
        // If successful, user will be redirected to callback URL
      } catch (error) {
        console.error("Google signin error:", error);
        toast.error("Failed to initiate Google signin. Please try again.");
      }
    });
  };

  /**
   * Handle Google OAuth callback and extract user data
   * This would typically be called from a callback page
   */
  const handleGoogleCallback = async (googleUser: GoogleUser) => {
    setFormData((prev) => ({ ...prev, googleUser }));
    setCurrentStep("profile");
    setValidationErrors({});
  };

  /**
   * Complete Google signup with additional profile data
   */
  const completeGoogleSignup = async (
    profileData: CompleteGoogleSignupInput,
  ) => {
    startTransition(async () => {
      try {
        if (!formData.googleUser || !community) {
          toast.error("Missing required data. Please try again.");
          return;
        }

        const formDataToSubmit = new FormData();
        formDataToSubmit.append("phone", profileData.phone);
        formDataToSubmit.append("street", profileData.address.street);
        formDataToSubmit.append("city", profileData.address.city);
        formDataToSubmit.append("state", profileData.address.state);
        formDataToSubmit.append("zipCode", profileData.address.zipCode);
        formDataToSubmit.append("unit", profileData.address.unit || "");
        formDataToSubmit.append("joinCode", formData.joinCode || "");
        formDataToSubmit.append("userId", formData.googleUser.id);
        formDataToSubmit.append("googleEmail", formData.googleUser.email);
        formDataToSubmit.append(
          "googleFirstName",
          formData.googleUser.firstName,
        );
        formDataToSubmit.append("googleLastName", formData.googleUser.lastName);
        formDataToSubmit.append(
          "googleProfileImageUrl",
          formData.googleUser.profileImageUrl || "",
        );

        const result = await signupGoogleAction(
          { success: false },
          formDataToSubmit,
        );

        if (result.success) {
          setFormData((prev) => ({ ...prev, ...profileData }));

          if (result.requiresOnboarding) {
            setCurrentStep("onboarding");
            toast.success(
              "Account created! Please complete your profile setup.",
            );
          } else {
            // Account fully set up
            router.push("/dashboard");
          }
        } else {
          setValidationErrors({ general: result.error || "Signup failed" });
          toast.error(result.error || "Please try again.");
        }
      } catch (error) {
        console.error("Google signup error:", error);
        toast.error("Failed to create account. Please try again.");
      }
    });
  };

  /**
   * Alternative method for completing Google signup after OAuth callback
   * This handles the case where the user is already authenticated via Better Auth
   */
  const completeGoogleSignupAfterAuth = async (
    googleUser: GoogleUser,
    profileData: CompleteGoogleSignupInput,
    communityId: string,
  ) => {
    startTransition(async () => {
      try {
        const result = await completeGoogleSignupAfterOAuth(
          googleUser,
          profileData,
          communityId,
        );

        if (result.success) {
          setFormData((prev) => ({ ...prev, googleUser, ...profileData }));

          if (result.requiresOnboarding) {
            setCurrentStep("onboarding");
            toast.success(
              "Account created! Please complete your profile setup.",
            );
          } else {
            // Account fully set up
            router.push("/dashboard");
          }
        } else {
          setValidationErrors({ general: result.error || "Signup failed" });
          toast.error(result.error || "Please try again.");
        }
      } catch (error) {
        console.error("Google signup completion error:", error);
        toast.error("Failed to complete account setup. Please try again.");
      }
    });
  };

  /**
   * Complete onboarding after Google signup
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
    if (currentStep === "oauth") {
      setCurrentStep("joinCode");
      setCommunity(null);
      setFormData((prev) => ({ joinCode: prev.joinCode }));
    } else if (currentStep === "profile") {
      setCurrentStep("oauth");
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
    initiateGoogleSignin,
    handleGoogleCallback,
    completeGoogleSignup,
    completeGoogleSignupAfterAuth,
    completeOnboarding,
    goBack,
    reset,
    updateFormData,
    setErrors,

    // Helpers
    canGoBack: currentStep !== "joinCode",
    isJoinCodeValid: !!community,
    isGoogleUserReady: !!formData.googleUser,
    isProfileComplete: !!(
      formData.googleUser &&
      formData.phone &&
      formData.street &&
      formData.city &&
      formData.state &&
      formData.zipCode
    ),
    hasGoogleProfileImage: !!formData.googleUser?.profileImageUrl,
  };
}
