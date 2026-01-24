import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { AuthLayoutWrapper } from "@/features/auth/components/auth-layout-wrapper";
import { AnimatedAuthCard } from "@/features/auth/components/animated-auth-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Forgot Password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthLayoutWrapper>
      <AnimatedAuthCard delay={100}>
        <Card className="mx-auto w-full max-w-md">
          <CardHeader className="pt-4">
            <CardTitle className="text-2xl">Forgot Password</CardTitle>
            <CardDescription>
              Enter your email address and we&apos;ll send you a link to reset
              your password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ForgotPasswordForm />
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
      </AnimatedAuthCard>
    </AuthLayoutWrapper>
  );
}
