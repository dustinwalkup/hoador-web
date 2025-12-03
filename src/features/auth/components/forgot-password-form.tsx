"use client";

import { useActionState, useEffect } from "react";
import { Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { forgotPasswordAction } from "../actions/forgot-password";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    forgotPasswordAction,
    null,
  );

  // Handle success/error states
  useEffect(() => {
    if (state?.success && state.message) {
      toast.success("Email Sent", {
        description: state.message,
      });
    } else if (state?.error) {
      toast.error("Error", {
        description: state.error,
      });
    }
  }, [state]);

  // Show success state if email was sent
  if (state?.success) {
    return (
      <div className="space-y-4 text-center">
        <div className="bg-primary/10 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
          <CheckCircle className="text-primary h-8 w-8" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Check your email
          </h3>
          <p className="mt-2 text-sm text-gray-600">{state.message}</p>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="name@example.com"
          required
          disabled={isPending}
        />
      </div>

      {/* Submit */}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          "Send Reset Password Email"
        )}
      </Button>
    </form>
  );
}
