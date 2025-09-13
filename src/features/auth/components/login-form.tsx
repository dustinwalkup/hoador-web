// components/forms/LoginForm.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { GoogleIcon } from "../../../../public/svg/google-icon";
import { useLoginForm } from "../hooks/use-login-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const {
    state,
    formAction,
    isPending,
    showPassword,
    togglePassword,
    handleGoogleSignIn,
  } = useLoginForm(callbackUrl);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="name@example.com"
            required
            disabled={isPending}
            autoComplete="email"
            aria-describedby={state.error ? "form-error" : undefined}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">
              Password <span className="text-destructive">*</span>
            </Label>
            <Link
              href="/forgot-password"
              className="text-primary focus:ring-primary rounded text-sm hover:underline focus:ring-2 focus:ring-offset-2 focus:outline-none"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              disabled={isPending}
              autoComplete="current-password"
              aria-describedby={state.error ? "form-error" : undefined}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={togglePassword}
              disabled={isPending}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {state.error && (
          <Alert variant="destructive" id="form-error" role="alert">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={isPending}
          aria-describedby={isPending ? "loading-description" : undefined}
        >
          {isPending ? (
            <>
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              <span id="loading-description">Signing in...</span>
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background text-muted-foreground px-2">
            Or continue with
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className={cn("w-full", isPending && "grayscale")}
        onClick={handleGoogleSignIn}
        disabled={isPending}
      >
        <GoogleIcon />
        Continue with Google
      </Button>
    </div>
  );
}
