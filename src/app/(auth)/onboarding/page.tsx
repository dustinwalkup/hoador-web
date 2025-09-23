import { redirect } from "next/navigation";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

import { getCurrentUser } from "@/features/auth/utils/session";
import { OnboardingForm } from "@/features/onboarding/components/onboarding-form";
import { AuthLayoutWrapper } from "@/features/auth/components/auth-layout-wrapper";
import { communityDAL } from "@/dal";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }

  const communityName = await communityDAL.getCommunityNameByUserId(user.id);
  const userFirstName = user.name.split(" ")[0];
  const userLastName = user.name.split(" ")[1];

  return (
    <AuthLayoutWrapper isOnboarding>
      <Card>
        <CardHeader>
          <div className="mb-2 flex items-center justify-center gap-2">
            <CheckCircle className="text-primary h-5 w-5" />
            <span className="text-primary text-sm font-medium">
              {communityName}
            </span>
          </div>
          <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
          <CardDescription>
            Enter your information to finish setting up your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm
            communityName={communityName || ""}
            profileImageUrl={user.image || ""}
            userFirstName={userFirstName || ""}
            userLastName={userLastName || ""}
          />
        </CardContent>

        <CardFooter className="flex flex-col items-center gap-4">
          <div className="text-muted-foreground text-center text-sm">
            Need help?{" "}
            <Link href="/support" className="text-primary hover:underline">
              Contact support
            </Link>
          </div>
        </CardFooter>
      </Card>
    </AuthLayoutWrapper>
  );
}
