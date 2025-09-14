"use client";

import { useState, useEffect, useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSignupContext } from "../signup-context";
import { validateField } from "../../schemas/validation";
import { createAccountAction } from "../../actions/create-account";
import type { EmailSignupData } from "../../schemas/validation";

export function DetailsStep() {
  const {
    signupData,
    showPassword,
    updateSignupData,
    goToStep,
    togglePasswordVisibility,
    setUserId,
  } = useSignupContext();

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createAccountAction,
    null,
  );

  useEffect(() => {
    if (state?.success && state.data?.user) {
      setUserId(state.data.user.id);
      goToStep("email-confirmation");
    }
  }, [state, setUserId, goToStep]);

  // Clear general error when user makes changes
  useEffect(() => {
    if (state?.error) {
      setErrors((prev) => ({ ...prev, general: "" }));
    }
  }, [signupData, state?.error]);

  // ---------------------------
  // Helper for per-field validation (only runs after first submit attempt)
  // ---------------------------
  const handleFieldValidation = (
    field: keyof EmailSignupData,
    value: unknown,
  ) => {
    // Only validate after user has attempted to submit
    if (!hasAttemptedSubmit) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const error = validateField(field as any, value);
    setErrors((prev) => ({ ...prev, [field]: error || "" }));
  };

  // ---------------------------
  // Generic change handler
  // ---------------------------
  const handleChange = <K extends keyof EmailSignupData>(
    key: K,
    value: EmailSignupData[K],
  ) => {
    updateSignupData({ [key]: value } as Partial<EmailSignupData>);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handleFieldValidation(key as any, value);
  };

  // ---------------------------
  // Form validation
  // ---------------------------
  const validateAllFields = (): boolean => {
    const fieldsToValidate = [
      { field: "email", value: signupData.email },
      { field: "password", value: signupData.password },
    ] as const;

    let hasErrors = false;
    const newErrors: Record<string, string> = {};

    fieldsToValidate.forEach(({ field, value }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const error = validateField(field as any, value);
      if (error) {
        newErrors[field] = error;
        hasErrors = true;
      }
    });

    setErrors(newErrors);
    return !hasErrors;
  };

  // Check if all required fields are filled (for button state)
  const isFormComplete = Boolean(
    signupData.email?.trim() && signupData.password?.trim(),
  );

  // ---------------------------
  // Form submission handler
  // ---------------------------
  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    setHasAttemptedSubmit(true);

    // Validate all fields
    const isValid = validateAllFields();

    if (!isValid) {
      event.preventDefault();
      return;
    }

    // Form is valid, let it submit to server action
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <Link href="/" className="flex items-center justify-center gap-2">
        <Image
          src="/hoador-logo.svg"
          alt="Hoador Logo"
          width={100}
          height={40}
          className="h-6 w-auto"
          priority
        />
      </Link>

      <Card>
        <CardHeader>
          <div className="mb-2 flex items-center justify-center gap-2">
            <CheckCircle className="text-primary h-5 w-5" />
            <span className="text-primary text-sm font-medium">
              {signupData.communityName}
            </span>
          </div>
          <CardTitle className="text-2xl">Create Your Account</CardTitle>
          <CardDescription>
            Enter your email and password to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={formAction}
            onSubmit={handleFormSubmit}
            className="space-y-4"
          >
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                value={signupData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={signupData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  className={errors.password ? "border-red-500" : ""}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={togglePasswordVisibility}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {errors.password ? (
                <p className="text-xs text-red-500">{errors.password}</p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Must be at least 8 characters with uppercase, lowercase, and
                  number
                </p>
              )}
            </div>

            {/* Hidden fields for community info and terms */}
            <input
              type="hidden"
              name="joinCode"
              value={signupData.joinCode || ""}
            />
            <input
              type="hidden"
              name="communityId"
              value={signupData.communityId || ""}
            />

            {/* General errors */}
            {(errors.general || state?.error) && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-600">
                  {errors.general || state?.error}
                </p>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              disabled={!isFormComplete || isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goToStep("method")}
            className="text-muted-foreground"
            disabled={isPending}
          >
            ← Back to signup options
          </Button>
          <div className="text-muted-foreground text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Log in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
