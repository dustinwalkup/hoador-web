"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Mail, Loader2, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { resendVerificationEmailAction } from "../actions/verify-email";

interface SimpleVerifyEmailFormProps {
  email: string;
}

export function SimpleVerifyEmailForm({ email }: SimpleVerifyEmailFormProps) {
  const [state, formAction, isPending] = useActionState(
    resendVerificationEmailAction,
    { success: false },
  );

  return (
    <>
      {/* Header content for the card */}
      <div className="space-y-2 text-center">
        <div className="bg-primary/10 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
          <Mail className="text-primary h-8 w-8" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Check your email
        </h1>
        <p className="text-muted-foreground text-sm">
          We&apos;ve sent a confirmation link to <strong>{email}</strong>
        </p>
      </div>

      <div className="space-y-6">
        <div className="mt-4 space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {state?.success && state?.message && (
            <Alert className="bg-primary/5 border-primary/50 border">
              <CheckCircle className="text-primary! h-4 w-4" />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 text-center">
            <p className="text-muted-foreground text-sm">
              Click the link in the email to verify your account and complete
              your registration for
            </p>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
              <p>
                <strong>Didn&apos;t receive the email?</strong> Check your spam
                folder or click the button below to resend.
              </p>
            </div>

            <form action={formAction} noValidate>
              <input type="hidden" name="email" value={email} />
              <Button
                type="submit"
                variant="outline"
                disabled={isPending}
                className="w-full"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
          </div>
        </div>

        <div className="text-muted-foreground text-center text-xs">
          Need help? Contact your community administrator or{" "}
          <Link href="/support" className="text-green-600 underline">
            support
          </Link>
        </div>
      </div>
    </>
  );
}
