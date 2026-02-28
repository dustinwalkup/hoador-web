export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/features/auth/components/signup-form";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthLayoutWrapper } from "@/features/auth/components/auth-layout-wrapper";
import { AnimatedAuthCard } from "@/features/auth/components/animated-auth-card";
import { legalDocumentDAL } from "@/dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";

export const metadata: Metadata = {
  title: "Sign Up",
};

const SIGNUP_ERROR_MESSAGES: Record<string, string> = {
  invalid_token:
    "This verification link is invalid. Please sign up again or request a new verification email.",
  expired:
    "This verification link has expired. Please request a new verification email from the verify-email page.",
  already_verified:
    "This email is already verified. You can sign in to your account.",
  user_status_update_failed:
    "We couldn't complete verification. Please try again or contact support.",
  signup_failed:
    "Something went wrong during sign up. Please try again or use a different sign-in method.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorCode } = await searchParams;
  const errorMessage =
    errorCode && SIGNUP_ERROR_MESSAGES[errorCode]
      ? SIGNUP_ERROR_MESSAGES[errorCode]
      : errorCode
        ? "Something went wrong. Please try again."
        : null;

  // Fetch current document URLs server-side
  const documentVersions = await legalDocumentDAL.getAllCurrentVersions();

  const documentUrls = {
    tos: documentVersions[LEGAL_DOCUMENT_IDS.TOS]?.url || "",
    privacy: documentVersions[LEGAL_DOCUMENT_IDS.PRIVACY]?.url || "",
  };

  return (
    <AuthLayoutWrapper>
      <AnimatedAuthCard delay={100}>
        <Card className="mx-auto w-full max-w-md">
          <CardHeader className="pt-4">
            <CardTitle className="text-2xl">Create an account</CardTitle>
            <CardDescription>
              Enter your details to get started with Hoador
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignupForm
              documentUrls={documentUrls}
              errorMessage={errorMessage}
            />
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
