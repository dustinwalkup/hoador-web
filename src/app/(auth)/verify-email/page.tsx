import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { tryCatch } from "@walkup/walkup-utils";

import { AuthLayoutWrapper } from "@/features/auth/components/auth-layout-wrapper";
import { AnimatedAuthCard } from "@/features/auth/components/animated-auth-card";
import { VerifyEmailForm } from "@/features/auth/components/verify-email-form";
import { requireAuth } from "@/features/auth/utils/session";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

interface VerifyEmailPageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const { email: paramEmail } = await searchParams;

  // Get email from either params or session
  const email = paramEmail ? paramEmail : await getEmailFromSession();

  return (
    <AuthLayoutWrapper>
      <AnimatedAuthCard delay={100}>
        <Card>
          <CardHeader className="space-y-1 pt-4 text-center">
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
          </CardHeader>
          <CardContent>
            <VerifyEmailForm email={email} />
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-4">
            {" "}
            <div className="text-muted-foreground text-center text-xs">
              Need help? Contact your community administrator or{" "}
              <Link href="/support" className="text-green-600 underline">
                support
              </Link>
            </div>
          </CardFooter>
        </Card>
      </AnimatedAuthCard>
    </AuthLayoutWrapper>
  );
}

// Helper functions
async function getEmailFromSession() {
  const { data: user, error } = await tryCatch(requireAuth());

  if (!user?.id || !user?.email || error) {
    redirect("/login");
  }

  return user.email;
}
