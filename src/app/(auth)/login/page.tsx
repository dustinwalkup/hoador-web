import Link from "next/link";
import { LoginForm } from "@/features/auth/components/login-form";
import { SuccessMessage } from "@/features/auth/components/success-message";
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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthLayoutWrapper>
      <AnimatedAuthCard delay={100}>
        <Card className="mx-auto w-full max-w-md">
          <CardHeader className="pt-4">
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            {params.message === "password-reset-success" && (
              <div className="mb-4">
                <SuccessMessage
                  title="Password Reset Successful"
                  description="Your password has been reset successfully. Please log in with your new password."
                />
              </div>
            )}
            <LoginForm />
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-4">
            <div className="text-muted-foreground text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-primary hover:underline">
                Sign up
              </Link>
            </div>
          </CardFooter>
        </Card>
      </AnimatedAuthCard>
    </AuthLayoutWrapper>
  );
}
