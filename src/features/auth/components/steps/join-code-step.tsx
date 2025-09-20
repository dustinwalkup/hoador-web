"use client";

import { useActionState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSignupContext } from "../signup-context";
import { validateJoinCodeAction } from "../../actions/join-code";

export function JoinCodeStep() {
  const { signupData, updateSignupData, goToStep } = useSignupContext();

  const [state, formAction, isPending] = useActionState(
    validateJoinCodeAction,
    null,
  );

  useEffect(() => {
    if (state?.success && state.data?.community) {
      updateSignupData({
        communityId: state.data.community.id,
        communityName: state.data.community.name,
      });
      goToStep("method");
    }
  }, [state, updateSignupData, goToStep]);

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
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="join-code">Community Join Code</Label>
              <Input
                id="join-code"
                name="joinCode"
                placeholder="Enter your join code"
                value={signupData.joinCode}
                onChange={(e) =>
                  updateSignupData({ joinCode: e.target.value.toUpperCase() })
                }
                className="text-center text-lg tracking-wider"
                disabled={isPending}
                required
              />
            </div>

            {state?.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!signupData.joinCode.trim() || isPending}
            >
              {isPending ? "Validating..." : "Continue"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-4 text-center">
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
        </CardFooter>
      </Card>
    </div>
  );
}
