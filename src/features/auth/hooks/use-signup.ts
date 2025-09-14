"use client";

import { useState } from "react";
import type { EmailSignupData } from "../schemas/validation";
import { authClient } from "@/services/better-auth/client";
import { signInSocial } from "../utils";

export type SignupStep =
  | "join-code"
  | "method"
  | "details"
  | "email-confirmation";
export type SignupMethod = "email" | "google" | null;

export interface SignupData extends EmailSignupData {
  joinCode: string;
  communityId: string;
  communityName: string;
  signupMethod: SignupMethod;
}

const defaultSignupData: SignupData = {
  joinCode: "",
  communityId: "",
  communityName: "",
  signupMethod: null,
  email: "",
  password: "",
};

export function useSignup() {
  const [currentStep, setCurrentStep] = useState<SignupStep>("join-code");
  const [showPassword, setShowPassword] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [signupData, setSignupData] = useState<SignupData>(defaultSignupData);

  const updateSignupData = (updates: Partial<SignupData>) => {
    setSignupData((prev) => ({ ...prev, ...updates }));
  };

  const handleGoogleSignup = async () => {
    try {
      await signInSocial("google");
      // Initiate Google OAuth with state
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/signup/google/callback?joinCode=" + signupData.joinCode,
      });
    } catch (error) {
      console.error("Google signup error:", error);
      // Could add error state here if needed
    }
  };

  const selectSignupMethod = (method: SignupMethod) => {
    updateSignupData({ signupMethod: method });
    if (method === "google") {
      handleGoogleSignup();
    } else {
      setCurrentStep("details");
    }
  };

  const goToStep = (step: SignupStep) => {
    setCurrentStep(step);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return {
    currentStep,
    signupData,
    showPassword,
    userId,
    updateSignupData,
    selectSignupMethod,
    goToStep,
    togglePasswordVisibility,
    setUserId,
  };
}
