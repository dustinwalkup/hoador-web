import { redirect } from "next/navigation";
import { userDAL } from "@/dal";
import { getSession } from "@/features/auth/utils/session";

export default async function EmailSignupCallback({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  // Get authenticated user session
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  if (searchParams.error) {
    redirect(`/signup?error=${searchParams.error}`);
  }

  try {
    // Update user status, this means the user has verified their email
    await userDAL.updateUserStatus(session.user.id, "incomplete_profile");
  } catch (error) {
    console.log("Error updating user status: ", error);
    redirect("/signup?error=user_status_update_failed");
  }
  // Redirect to onboarding
  redirect("/onboarding");
}
