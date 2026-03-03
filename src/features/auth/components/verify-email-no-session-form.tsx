"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useResendVerification } from "../hooks/use-auth-mutations";

/**
 * Shown on verify-email when there is no session and no email in URL
 * (e.g. user cleared cookies or opened link on another device).
 * Lets user enter email to resend the verification link.
 */
export function VerifyEmailNoSessionForm() {
  const [email, setEmail] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const mutation = useResendVerification();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowSuccess(false);
    if (!email.trim()) return;
    try {
      await mutation.mutateAsync({ email: email.trim() });
      setShowSuccess(true);
    } catch {
      // Error is handled by the mutation hook
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-center text-sm">
        We couldn&apos;t find your session. Enter your email to resend the
        verification link.
      </p>

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
          <CheckCircle className="h-4 w-4" />
          <AlertDescription className="text-primary!">
            Verification email sent! Please check your inbox.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={mutation.isPending}
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={!email.trim() || mutation.isPending}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Resend verification email
            </>
          )}
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link
          href="/login?message=session-expired"
          className="text-primary underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
