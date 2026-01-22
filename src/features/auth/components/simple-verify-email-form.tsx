"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useResendVerification } from "../hooks/use-auth-mutations";

interface SimpleVerifyEmailFormProps {
  email: string;
}

export function SimpleVerifyEmailForm({ email }: SimpleVerifyEmailFormProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const mutation = useResendVerification();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowSuccess(false);
    try {
      await mutation.mutateAsync({ email });
      setShowSuccess(true);
    } catch {
      // Error is handled by the mutation hook
    }
  };

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
          {mutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : "Failed to send verification email"}
              </AlertDescription>
            </Alert>
          )}

          {showSuccess && (
            <Alert className="bg-primary/5 border-primary/50 border">
              <CheckCircle className="text-primary! h-4 w-4" />
              <AlertDescription>
                Verification email sent! Please check your inbox.
              </AlertDescription>
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

            <form onSubmit={handleSubmit} noValidate>
              <Button
                type="submit"
                variant="outline"
                disabled={mutation.isPending}
                className="w-full"
              >
                {mutation.isPending ? (
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
