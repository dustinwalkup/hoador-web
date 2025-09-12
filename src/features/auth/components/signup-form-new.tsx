"use client";

import { SignupProvider, useSignupContext } from "../components/signup-context";
import { JoinCodeStep } from "../components/steps/join-code-step";
import { MethodStep } from "../components/steps/method-step";
import { DetailsStep } from "../components/steps/details-step";
import { EmailConfirmationStep } from "../components/steps/email-confirmation-step";

function SignupFormContent() {
  const { currentStep } = useSignupContext();

  switch (currentStep) {
    case "join-code":
      return <JoinCodeStep />;
    case "method":
      return <MethodStep />;
    case "details":
      return <DetailsStep />;
    case "email-confirmation":
      return <EmailConfirmationStep />;
    default:
      return <JoinCodeStep />;
  }
}

export function SignupForm() {
  return (
    <SignupProvider>
      <SignupFormContent />
    </SignupProvider>
  );
}
