"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { tryCatch } from "@walkup/walkup-utils";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { loginSchema, type LoginData } from "../schemas/auth-schemas";
import { GoogleIcon } from "../../../../public/svg/google-icon";
import { signInEmail, signInSocial, getSafeCallbackUrl } from "../utils";
import { containerVariants, fieldVariants } from "./animated-form-field";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl"));

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
  });

  const handleEmailLogin = async (data: LoginData) => {
    setIsLoading(true);
    setError(null);

    const { error: authError } = await tryCatch(
      signInEmail(data.email, data.password, callbackUrl),
    );

    if (authError) {
      // Network/timeout vs auth errors
      const isNetworkError =
        authError.message === "Failed to fetch" ||
        authError.name === "TypeError" ||
        authError.message?.toLowerCase().includes("network") ||
        authError.message?.toLowerCase().includes("timeout");
      if (isNetworkError) {
        setError(
          "We couldn't reach the server. Check your connection and try again.",
        );
      } else if (authError.message?.includes("email not verified")) {
        setError("Please verify your email address before signing in.");
      } else if (
        authError.message?.includes("invalid") ||
        authError.message?.includes("credentials") ||
        authError.message?.includes("password")
      ) {
        setError("Invalid email or password. Please try again.");
      } else {
        setError("Failed to sign in. Please try again.");
      }
      setIsLoading(false);
      return;
    }

    // Full page navigation so dashboard (and proxy) see the new session and can
    // apply status-based redirects (e.g. email_verified → /join-code).
    window.location.replace(callbackUrl);
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    const { error: authError } = await tryCatch(
      signInSocial("google", callbackUrl),
    );

    if (authError) {
      const isNetworkError =
        authError.message === "Failed to fetch" ||
        authError.name === "TypeError" ||
        authError.message?.toLowerCase().includes("network") ||
        authError.message?.toLowerCase().includes("timeout");
      setError(
        isNetworkError
          ? "We couldn't reach the server. Check your connection and try again."
          : "Failed to sign in with Google. Please try again.",
      );
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Error Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Google Sign In Button */}
      <motion.div variants={fieldVariants}>
        <motion.div
          whileHover={!isLoading ? { scale: 1.02 } : {}}
          whileTap={!isLoading ? { scale: 0.98 } : {}}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon className="mr-2 h-4 w-4" />
            )}
            Continue with Google
          </Button>
        </motion.div>
      </motion.div>

      <motion.div variants={fieldVariants}>
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
      </motion.div>

      {/* Email/Password Form */}
      <form
        onSubmit={handleSubmit(handleEmailLogin)}
        className="space-y-4"
        noValidate
      >
        <motion.div variants={fieldVariants}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              disabled={isLoading}
              {...register("email")}
            />
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
        </motion.div>

        <motion.div variants={fieldVariants}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-primary text-xs hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                disabled={isLoading}
                {...register("password")}
              />
              <motion.button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={isLoading}
                whileHover={!isLoading ? { scale: 1.1 } : {}}
                whileTap={!isLoading ? { scale: 0.9 } : {}}
                transition={{ duration: 0.2 }}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </motion.button>
            </div>
            {errors.password && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-600"
              >
                {errors.password.message}
              </motion.p>
            )}
          </div>
        </motion.div>

        <motion.div variants={fieldVariants}>
          <motion.div
            whileHover={!isLoading ? { scale: 1.02 } : {}}
            whileTap={!isLoading ? { scale: 0.98 } : {}}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </motion.div>
        </motion.div>
      </form>
    </motion.div>
  );
}
