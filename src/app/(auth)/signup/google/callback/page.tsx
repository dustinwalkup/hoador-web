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
    // Fetch current user profile to check existing status
    const userProfile = await userDAL.getUserById(session.user.id);
    const currentStatus = userProfile.status;

    // For new Google signups, status will be "pending_verification" (from DB default)
    // Update to "email_verified" only if status is "pending_verification"
    // For existing users (with status "active", "incomplete_profile", etc.), preserve their status
    if (currentStatus === "pending_verification") {
      await userDAL.updateUserStatus(session.user.id, "email_verified");
    }

    // Set user profile photo
    if (session.user.image) {
      await userDAL.updateUserProfilePhoto(session.user.id, session.user.image);
    }

    // Determine final status after potential update
    const finalStatus =
      currentStatus === "pending_verification"
        ? "email_verified"
        : currentStatus;

    // Redirect based on final user status
    // Active users should go to dashboard, others to join-code
    if (finalStatus === "active") {
      redirect("/dashboard");
    } else {
      redirect("/join-code");
    }
  } catch (error) {
    console.error("Community association failed:", error);
    redirect("/signup?error=community_failed");
  }
}
