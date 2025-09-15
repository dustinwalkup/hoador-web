"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

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
      <Card className="mx-auto w-full max-w-md">
        <CardHeader></CardHeader>
        <CardContent>
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <CheckCircle className="text-primary h-12 w-12" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Check your email
              </h3>
              <p className="mt-2 text-sm text-gray-600">{state.message}</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-4">
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="w-full"
          >
            Send another email
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Forgot Password</CardTitle>
        <CardDescription>
          Enter your email address and we&apos;ll send you a link to reset your
          password
        </CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
      <CardFooter className="flex flex-col items-center gap-4">
        <div className="text-muted-foreground text-center text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
