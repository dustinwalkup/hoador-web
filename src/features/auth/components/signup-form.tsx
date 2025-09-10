"use client";

import type React from "react";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";

type SignupStep = "join-code" | "method" | "details";

export function SignupForm() {
  const [currentStep, setCurrentStep] = useState<SignupStep>("join-code");
  const [joinCode, setJoinCode] = useState("");
  const [communityName, setCommunityName] = useState("");
  const [signupMethod, setSignupMethod] = useState<"email" | "google" | null>(
    null,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [codeError, setCodeError] = useState("");

  console.log(signupMethod);

  // Mock community validation
  const validateJoinCode = async (code: string) => {
    setIsValidatingCode(true);
    setCodeError("");

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (code.toLowerCase() === "demo123") {
      setCommunityName("Sunset Village Community");
      setCurrentStep("method");
    } else {
      setCodeError(
        "Invalid join code. Please check with your community administrator.",
      );
    }
    setIsValidatingCode(false);
  };

  const handleJoinCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      validateJoinCode(joinCode.trim());
    }
  };

  const handleMethodSelect = (method: "email" | "google") => {
    setSignupMethod(method);
    if (method === "google") {
      // In real implementation, this would trigger Google OAuth
      console.log("Initiating Google OAuth...");
    } else {
      setCurrentStep("details");
    }
  };

  const handleEmailSignup = (e: React.FormEvent) => {
    e.preventDefault();
    // In real implementation, this would handle the signup
    console.log("Processing email signup...");
  };

  if (currentStep === "join-code") {
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
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Join Your Community</CardTitle>
            <CardDescription>
              Enter the join code provided by your community administrator
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinCodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="join-code">Community Join Code</Label>
                <Input
                  id="join-code"
                  placeholder="Enter your join code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="text-center text-lg tracking-wider"
                  disabled={isValidatingCode}
                  required
                />
              </div>

              {codeError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{codeError}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={!joinCode.trim() || isValidatingCode}
              >
                {isValidatingCode ? "Validating..." : "Continue"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="text-center">
            <div className="flex w-full flex-col items-center gap-2">
              <p className="text-muted-foreground text-sm">
                Don&apos;t have a join code?{" "}
                <Link href="/contact" className="text-primary hover:underline">
                  Contact support
                </Link>
              </p>
              <div className="text-muted-foreground text-center text-sm">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline">
                  Log in
                </Link>
              </div>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (currentStep === "method") {
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
          <CardHeader className="text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <CheckCircle className="text-primary h-5 w-5" />
              <span className="text-primary text-sm font-medium">
                {communityName}
              </span>
            </div>
            <CardTitle className="text-2xl">Create Your Account</CardTitle>
            <CardDescription>
              Choose how you&apos;d like to sign up
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="h-12 w-full justify-center gap-3 bg-transparent text-left"
              onClick={() => handleMethodSelect("google")}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background text-muted-foreground px-2">
                  Or
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className="h-12 w-full bg-transparent"
              onClick={() => handleMethodSelect("email")}
            >
              Continue with Email
            </Button>
          </CardContent>
          <CardFooter className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentStep("join-code")}
              className="text-muted-foreground"
            >
              ← Back to join code
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

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
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-600">
              {communityName}
            </span>
          </div>
          <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
          <CardDescription>
            Enter your information to finish creating your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailSignup} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name">First name</Label>
                <Input id="first-name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Last name</Label>
                <Input id="last-name" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Must be at least 8 characters with uppercase, lowercase, and
                number
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="Enter your street address"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP code</Label>
                <Input id="zip" required />
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox id="terms" className="mt-1" />
              <label
                htmlFor="terms"
                className="text-sm leading-relaxed peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I agree to the{" "}
                <Link href="/terms" className="text-primary hover:underline">
                  terms of service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-primary hover:underline">
                  privacy policy
                </Link>
              </label>
            </div>

            <Button type="submit" className="w-full">
              Create Account
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentStep("method")}
            className="text-muted-foreground"
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
