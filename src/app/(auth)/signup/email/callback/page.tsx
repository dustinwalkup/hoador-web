export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { userDAL } from "@/dal";
import { getSession } from "@/features/auth/utils/session";

export const metadata: Metadata = {
  title: "Loading",
};

export default async function EmailSignupCallback({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Get authenticated user session
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const { error } = await searchParams;
  if (error) {
    redirect(`/signup?error=${error}`);
  }

  try {
    // Update user status, this means the user has verified their email
    await userDAL.updateUserStatus(session.user.id, "email_verified");
  } catch (error) {
    console.log("Error updating user status: ", error);
    redirect("/signup?error=user_status_update_failed");
  }
  // Redirect to onboarding
  redirect("/join-code");
}
