"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResetPassword } from "../hooks/use-auth-mutations";
import { passwordSchema } from "../schemas/password";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mutation = useResetPassword();

  // Show error if no token
  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">
            Invalid reset link. Please request a new password reset.
          </p>
        </div>
      </div>
    );
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Password validation using Zod
  const passwordValidation = passwordSchema.safeParse(password);
  const isPasswordValid = passwordValidation.success;

  // Get individual validation results for UI feedback
  const getValidationStatus = (regex: RegExp, minLength?: number) => {
    if (minLength) return password.length >= minLength;
    return regex.test(password);
  };

  const isPasswordLongEnough = getValidationStatus(/.*/, 8);
  const hasUppercase = getValidationStatus(/[A-Z]/);
  const hasLowercase = getValidationStatus(/[a-z]/);
  const hasNumber = getValidationStatus(/\d/);

  // Check if passwords match
  const passwordsMatch = password === confirmPassword;
  const isFormValid = isPasswordValid && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token || !isFormValid) {
      return;
    }
    try {
      await mutation.mutateAsync({ token, password });
    } catch {
      // Error is handled by the mutation hook
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mutation.isError && mutation.error?.message && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{mutation.error.message}</p>
        </div>
      )}
      {/* New Password */}
      <div className="space-y-2">
        <Label htmlFor="password">New Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={mutation.isPending}
            placeholder="Enter your new password"
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
        {password && (
          <div className="space-y-1 text-xs">
            <p
              className={`${isPasswordLongEnough ? "text-primary" : "text-red-500"}`}
            >
              ✓ At least 8 characters
            </p>
            <p className={`${hasUppercase ? "text-primary" : "text-red-500"}`}>
              ✓ One uppercase letter
            </p>
            <p className={`${hasLowercase ? "text-primary" : "text-red-500"}`}>
              ✓ One lowercase letter
            </p>
            <p className={`${hasNumber ? "text-primary" : "text-red-500"}`}>
              ✓ One number
            </p>
          </div>
        )}
        {!password && (
          <p className="text-muted-foreground text-xs">
            Must be at least 8 characters with uppercase, lowercase, and number
          </p>
        )}
      </div>

      {/* Confirm Password */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm New Password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={mutation.isPending}
          placeholder="Confirm your new password"
        />
        {confirmPassword && !passwordsMatch && (
          <p className="text-xs text-red-500">Passwords do not match</p>
        )}
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full"
        disabled={!isFormValid || mutation.isPending}
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Resetting Password...
          </>
        ) : (
          "Reset Password"
        )}
      </Button>
    </form>
  );
}
