import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/utils/session";
import { OnboardingForm } from "@/features/onboarding/components/onboarding-form";
import { communityDAL } from "@/dal";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }

  const communityName = await communityDAL.getCommunityNameByUserId(user.id);
  const userFirstName = user.name.split(" ")[0];
  const userLastName = user.name.split(" ")[1];

  return (
    <OnboardingForm
      communityName={communityName || ""}
      profileImageUrl={user.image || ""}
      userFirstName={userFirstName || ""}
      userLastName={userLastName || ""}
    />
  );
}
