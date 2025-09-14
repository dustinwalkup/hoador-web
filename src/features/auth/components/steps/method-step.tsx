"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

import { GoogleIcon } from "../../../../../public/svg/google-icon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useSignupContext } from "../signup-context";

export function MethodStep() {
  const { signupData, selectSignupMethod, goToStep } = useSignupContext();

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
              {signupData.communityName}
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
            onClick={() => selectSignupMethod("google")}
          >
            <GoogleIcon className="h-5 w-5" />
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
            onClick={() => selectSignupMethod("email")}
          >
            Continue with Email
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goToStep("join-code")}
            className="text-muted-foreground"
          >
            ← Back to join code
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
