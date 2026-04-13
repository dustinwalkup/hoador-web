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
  const { error } = await searchParams;
  if (error) {
    redirect(`/signup?error=${error}`);
  }

  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  try {
    const userProfile = await userDAL.getUserById(session.user.id);

    // Only update status if the user hasn't already progressed past email verification
    if (userProfile.status === "pending_verification") {
      await userDAL.updateUserStatus(session.user.id, "email_verified");
    }

    // Redirect based on current status to avoid regressing the flow
    switch (userProfile.status) {
      case "active":
        redirect("/dashboard");
      case "incomplete_profile":
        redirect("/onboarding");
      default:
        redirect("/join-code");
    }
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      const redirectError = error as { digest?: string };
      if (redirectError.digest?.startsWith("NEXT_REDIRECT")) {
        throw error;
      }
    }
    console.log("Error updating user status: ", error);
    redirect("/signup?error=user_status_update_failed");
  }
}
