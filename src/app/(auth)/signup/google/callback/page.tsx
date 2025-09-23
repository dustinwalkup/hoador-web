import { redirect } from "next/navigation";
import { userDAL } from "@/dal";
import { getSession } from "@/features/auth/utils/session";

export default async function GoogleSignupCallback() {
  // Get authenticated user session
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  try {
    // Set user status
    await userDAL.updateUserStatus(session.user.id, "email_verified");

    // Set user profile photo
    if (session.user.image) {
      await userDAL.updateUserProfilePhoto(session.user.id, session.user.image);
    }
  } catch (error) {
    console.error("Community association failed:", error);
    redirect("/signup?error=community_failed");
  }
  // Redirect to onboarding
  redirect("/join-code");
}
