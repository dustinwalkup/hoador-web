"use client";

import { Mail, Loader2, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useResendVerification } from "../hooks/use-auth-mutations";

interface SimpleVerifyEmailFormProps {
  email: string;
}

export function VerifyEmailForm({ email }: SimpleVerifyEmailFormProps) {
  const resendVerification = useResendVerification();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    resendVerification.mutate({ email });
  };

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-4">
          {resendVerification.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {resendVerification.error?.message ||
                  "Failed to resend verification email"}
              </AlertDescription>
            </Alert>
          )}

          {resendVerification.isSuccess && (
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
                disabled={resendVerification.isPending}
                className="w-full"
              >
                {resendVerification.isPending ? (
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
      </div>
    </>
  );
}
