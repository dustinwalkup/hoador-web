"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

import { GoogleIcon } from "../../../../public/svg/google-icon";
import { authClient } from "@/services/better-auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useSignup } from "../hooks/use-auth-mutations";
import {
  emailSignupSchema,
  type EmailSignupInput,
} from "../schemas/auth-schemas";
import { AnimatedFormField } from "./animated-form-field";

interface SignupFormProps {
  documentUrls: {
    tos: string;
    privacy: string;
  };
  /** User-friendly message from URL (e.g. verification link expired) */
  errorMessage?: string | null;
}

export function SignupForm({ documentUrls, errorMessage }: SignupFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const mutation = useSignup();

  const [legalAccepted, setLegalAccepted] = useState(false);

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

  // Watch acceptance value for form validation
  watch("legalAccepted");

  // Handle form submission with client-side validation first
  const onSubmit = async (data: EmailSignupInput) => {
    try {
      await mutation.mutateAsync({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        legalAccepted: data.legalAccepted,
      });
    } catch {
      // Error is handled by the mutation hook
    }
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

  const isFormPending = mutation.isPending;

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1,
          },
        },
      }}
    >
      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      {/* Google Sign Up Button */}
      <AnimatedFormField delay={300}>
        <motion.div
          whileHover={!isGoogleLoading && !isFormPending ? { scale: 1.02 } : {}}
          whileTap={!isGoogleLoading && !isFormPending ? { scale: 0.98 } : {}}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
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
        </motion.div>
      </AnimatedFormField>

      <AnimatedFormField delay={400}>
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
      </AnimatedFormField>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {mutation.isError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Alert variant="destructive">
              <AlertDescription>
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : "Failed to create account"}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <AnimatedFormField delay={500}>
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <motion.div
                whileFocus={{ scale: 1.01 }}
                transition={{ duration: 0.2 }}
              >
                <Input
                  id="firstName"
                  placeholder="John"
                  disabled={isFormPending}
                  {...register("firstName")}
                />
              </motion.div>
              {errors.firstName && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-600"
                >
                  {errors.firstName.message}
                </motion.p>
              )}
            </div>
          </AnimatedFormField>
          <AnimatedFormField delay={600}>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <motion.div
                whileFocus={{ scale: 1.01 }}
                transition={{ duration: 0.2 }}
              >
                <Input
                  id="lastName"
                  placeholder="Doe"
                  disabled={isFormPending}
                  {...register("lastName")}
                />
              </motion.div>
              {errors.lastName && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-600"
                >
                  {errors.lastName.message}
                </motion.p>
              )}
            </div>
          </AnimatedFormField>
        </div>

        <AnimatedFormField delay={700}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <motion.div
              whileFocus={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
            >
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                disabled={isFormPending}
                {...register("email")}
              />
            </motion.div>
            {errors.email && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-600"
              >
                {errors.email.message}
              </motion.p>
            )}
          </div>
        </AnimatedFormField>

        <AnimatedFormField delay={800}>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <motion.div
              className="relative"
              whileFocus={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
            >
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                disabled={isFormPending}
                {...register("password")}
              />
              <motion.button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={isFormPending}
                whileHover={!isFormPending ? { scale: 1.1 } : {}}
                whileTap={!isFormPending ? { scale: 0.9 } : {}}
                transition={{ duration: 0.2 }}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </motion.button>
            </motion.div>
            {errors.password && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-600"
              >
                {errors.password.message}
              </motion.p>
            )}
            <p className="text-muted-foreground text-xs">
              Must be at least 8 characters with uppercase, lowercase, and
              number
            </p>
          </div>
        </AnimatedFormField>

        <AnimatedFormField delay={900}>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <motion.div
                whileHover={!isFormPending ? { scale: 1.05 } : {}}
                whileTap={!isFormPending ? { scale: 0.95 } : {}}
                transition={{ duration: 0.2 }}
              >
                <Checkbox
                  id="legalAccepted"
                  checked={legalAccepted}
                  onCheckedChange={(checked) => {
                    setLegalAccepted(checked === true);
                    setValue("legalAccepted", checked === true, {
                      shouldValidate: true,
                    });
                  }}
                  disabled={isFormPending}
                />
              </motion.div>
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="legalAccepted"
                  className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I agree to the{" "}
                  <Link
                    href={documentUrls.tos}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:no-underline"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href={documentUrls.privacy}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:no-underline"
                  >
                    Privacy Policy
                  </Link>
                  .
                </Label>
              </div>
            </div>
            {errors.legalAccepted && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-600"
              >
                {errors.legalAccepted.message}
              </motion.p>
            )}
          </div>
        </AnimatedFormField>

        <AnimatedFormField delay={1000}>
          <motion.div
            whileHover={!isFormPending && legalAccepted ? { scale: 1.02 } : {}}
            whileTap={!isFormPending && legalAccepted ? { scale: 0.98 } : {}}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Button
              type="submit"
              className="w-full"
              disabled={isFormPending || !legalAccepted}
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
          </motion.div>
        </AnimatedFormField>
      </form>
    </motion.div>
  );
}
