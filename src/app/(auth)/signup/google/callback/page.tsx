import { redirect } from "next/navigation";
import { userDAL, communityDAL } from "@/dal";
import { getSession } from "@/features/auth/utils/session";

export default async function GoogleSignupCallback({
  searchParams,
}: {
  searchParams: Promise<{ joinCode?: string; error?: string }>;
}) {
  // Get authenticated user session
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  // Get join code from search params
  const { joinCode } = await searchParams;
  if (!joinCode) {
    redirect("/signup?error=join_code_not_found");
  }

  try {
    // Associate user with community
    await communityDAL.joinCommunityByCode(joinCode, session.user.id);

    // Set user status
    await userDAL.updateUserStatus(session.user.id, "incomplete_profile");

    // Set user profile photo
    if (session.user.image) {
      await userDAL.updateUserProfilePhoto(session.user.id, session.user.image);
    }
  } catch (error) {
    console.error("Community association failed:", error);
    redirect("/signup?error=community_failed");
  }
  // Redirect to onboarding
  redirect("/onboarding");
}
