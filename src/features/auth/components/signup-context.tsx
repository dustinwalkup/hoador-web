"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSignup } from "../hooks/use-signup";

const SignupContext = createContext<ReturnType<typeof useSignup> | null>(null);

export function SignupProvider({ children }: { children: ReactNode }) {
  const signupState = useSignup();

  return (
    <SignupContext.Provider value={signupState}>
      {children}
    </SignupContext.Provider>
  );
}

export function useSignupContext() {
  const context = useContext(SignupContext);
  if (!context) {
    throw new Error("useSignupContext must be used within a SignupProvider");
  }
  return context;
}
