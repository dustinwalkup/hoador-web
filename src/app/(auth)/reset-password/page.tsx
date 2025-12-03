import Link from "next/link";
import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { AuthLayoutWrapper } from "@/features/auth/components/auth-layout-wrapper";

export default function ResetPasswordPage() {
  return (
    <AuthLayoutWrapper>
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="pt-4">
          <CardTitle className="text-2xl">Reset Your Password</CardTitle>
          <CardDescription>
            Enter your new password below to reset your account password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={<div className="flex justify-center p-4">Loading...</div>}
          >
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-4">
          <div className="text-muted-foreground text-center text-sm">
            Remember your password?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Log in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </AuthLayoutWrapper>
  );
}
