"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { signupAction } from "../actions/signup";
import {
  emailSignupSchema,
  type EmailSignupInput,
} from "../schemas/auth-schemas";
import { GoogleIcon } from "../../../../public/svg/google-icon";
import { authClient } from "@/services/better-auth/client";
import Link from "next/link";

interface SignupFormProps {
  documentUrls: {
    tos: string;
    privacy: string;
    community: string;
  };
}

export function SignupForm({ documentUrls }: SignupFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isTransitionPending, startTransition] = useTransition();

  const [state, formAction, isPending] = useActionState(signupAction, {
    success: false,
  });

  const [tosAccepted, setTosAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [communityAccepted, setCommunityAccepted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<EmailSignupInput>({
    resolver: zodResolver(emailSignupSchema),
    mode: "onChange",
  });

  // Watch acceptance values for form validation
  watch("tosAccepted");
  watch("privacyAccepted");
  watch("communityAccepted");

  // Handle form submission with client-side validation first
  const onSubmit = async (data: EmailSignupInput) => {
    startTransition(() => {
      const formData = new FormData();
      formData.append("firstName", data.firstName);
      formData.append("lastName", data.lastName);
      formData.append("email", data.email);
      formData.append("password", data.password);
      formData.append("tosAccepted", String(data.tosAccepted));
      formData.append("privacyAccepted", String(data.privacyAccepted));
      formData.append("communityAccepted", String(data.communityAccepted));
      formAction(formData);
    });
  };

  const handleGoogleSignup = async () => {
    setIsGoogleLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/signup/google/callback",
      });
    } catch (error) {
      console.error("Google signup error:", error);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const isFormPending = isPending || isTransitionPending;

  return (
    <div className="space-y-6">
      {/* Google Sign Up Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignup}
        disabled={isGoogleLoading || isFormPending}
      >
        {isGoogleLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="mr-2 h-4 w-4" />
        )}
        Continue with Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background text-muted-foreground px-2">
            Or continue with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {state?.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              placeholder="John"
              disabled={isFormPending}
              {...register("firstName")}
            />
            {errors.firstName && (
              <p className="text-sm text-red-600">{errors.firstName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              placeholder="Doe"
              disabled={isFormPending}
              {...register("lastName")}
            />
            {errors.lastName && (
              <p className="text-sm text-red-600">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            disabled={isFormPending}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a strong password"
              disabled={isFormPending}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              disabled={isFormPending}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-red-600">{errors.password.message}</p>
          )}
          <p className="text-muted-foreground text-xs">
            Must be at least 8 characters with uppercase, lowercase, and number
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="tosAccepted"
                checked={tosAccepted}
                onCheckedChange={(checked) => {
                  setTosAccepted(checked === true);
                  setValue("tosAccepted", checked === true, {
                    shouldValidate: true,
                  });
                }}
                disabled={isFormPending}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="tosAccepted"
                  className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I accept the{" "}
                  <Link
                    href={documentUrls.tos}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:no-underline"
                  >
                    Terms of Service
                  </Link>
                </Label>
              </div>
            </div>
            {errors.tosAccepted && (
              <p className="text-sm text-red-600">
                {errors.tosAccepted.message}
              </p>
            )}
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="privacyAccepted"
              checked={privacyAccepted}
              onCheckedChange={(checked) => {
                setPrivacyAccepted(checked === true);
                setValue("privacyAccepted", checked === true, {
                  shouldValidate: true,
                });
              }}
              disabled={isFormPending}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="privacyAccepted"
                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I accept the{" "}
                <Link
                  href={documentUrls.privacy}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:no-underline"
                >
                  Privacy Policy
                </Link>
              </Label>
            </div>
          </div>
          {errors.privacyAccepted && (
            <p className="text-sm text-red-600">
              {errors.privacyAccepted.message}
            </p>
          )}

          <div className="flex items-start space-x-2">
            <Checkbox
              id="communityAccepted"
              checked={communityAccepted}
              onCheckedChange={(checked) => {
                setCommunityAccepted(checked === true);
                setValue("communityAccepted", checked === true, {
                  shouldValidate: true,
                });
              }}
              disabled={isFormPending}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="communityAccepted"
                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I accept the{" "}
                <Link
                  href={documentUrls.community}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:no-underline"
                >
                  Community Guidelines
                </Link>
              </Label>
            </div>
          </div>
          {errors.communityAccepted && (
            <p className="text-sm text-red-600">
              {errors.communityAccepted.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={
            isFormPending ||
            !tosAccepted ||
            !privacyAccepted ||
            !communityAccepted
          }
        >
          {isFormPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </div>
  );
}
