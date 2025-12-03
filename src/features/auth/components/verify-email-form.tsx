"use client";

import { useActionState } from "react";
import { Mail, Loader2, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { resendVerificationEmailAction } from "../actions/verify-email";

interface SimpleVerifyEmailFormProps {
  email: string;
}

export function VerifyEmailForm({ email }: SimpleVerifyEmailFormProps) {
  const [state, formAction, isPending] = useActionState(
    resendVerificationEmailAction,
    { success: false },
  );

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-4">
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
      </div>
    </>
  );
}
