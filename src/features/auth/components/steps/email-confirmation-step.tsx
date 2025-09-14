"use client";

import { useActionState } from "react";
import Image from "next/image";
import { Mail, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSignupContext } from "../signup-context";
import { resendConfirmationEmailAction } from "../../actions/email";

export function EmailConfirmationStep() {
  const { signupData, userId } = useSignupContext();

  const [state, formAction, isPending] = useActionState(
    resendConfirmationEmailAction,
    null,
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center space-y-6 bg-gray-50 p-4">
      <Image
        src="/hoador-logo.svg"
        alt="Hoador Logo"
        width={100}
        height={40}
        className="h-6 w-auto"
        priority
      />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Mail className="text-primary h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Check your email
          </CardTitle>
          <CardDescription className="text-gray-600">
            We&apos;ve sent a confirmation link to{" "}
            <span className="font-medium text-gray-900">
              {signupData.email}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-600">
              Click the link in the email to verify your account and complete
              your registration for{" "}
              <span className="font-medium">{signupData.communityName}</span>.
            </p>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                <strong>Didn&apos;t receive the email?</strong> Check your spam
                folder or click the button below to resend.
              </p>
            </div>
          </div>

          <form action={formAction}>
            <input type="hidden" name="email" value={signupData.email} />
            <input type="hidden" name="userId" value={userId || ""} />

            <Button
              type="submit"
              disabled={isPending || !userId}
              variant="outline"
              className="w-full bg-transparent"
            >
              {isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Resend confirmation email
                </>
              )}
            </Button>
          </form>

          {state?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">{state.error}</p>
            </div>
          )}

          {state?.success && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-primary text-sm">
                Confirmation email sent successfully!
              </p>
            </div>
          )}

          <div className="text-center">
            <p className="text-xs text-gray-500">
              Need help? Contact your community administrator or{" "}
              <a
                href="#"
                className="text-primary underline hover:text-green-700"
              >
                support
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
