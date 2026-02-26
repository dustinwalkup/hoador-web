export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { userDAL, legalDocumentDAL } from "@/dal";
import { getSession } from "@/features/auth/utils/session";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";

export const metadata: Metadata = {
  title: "Loading",
};

export default async function GoogleSignupCallback() {
  // Get authenticated user session
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  try {
    // Fetch user profile once; redirect by status before requiring legal acceptance
    const userProfile = await userDAL.getUserById(session.user.id);
    const status = userProfile.status;

    // Existing users: redirect by status and skip legal-acceptance
    if (status === "active") {
      if (session.user.image) {
        await userDAL.updateUserProfilePhoto(session.user.id, session.user.image);
      }
      redirect("/dashboard");
    }
    if (status === "incomplete_profile") {
      if (session.user.image) {
        await userDAL.updateUserProfilePhoto(session.user.id, session.user.image);
      }
      redirect("/onboarding");
    }
    if (status === "email_verified") {
      if (session.user.image) {
        await userDAL.updateUserProfilePhoto(session.user.id, session.user.image);
      }
      redirect("/join-code");
    }

    // New Google signups (pending_verification): require legal acceptance
    const [tosAccepted, privacyAccepted] = await Promise.all([
      legalDocumentDAL.hasAcceptedCurrentVersion(
        session.user.id,
        LEGAL_DOCUMENT_IDS.TOS,
      ),
      legalDocumentDAL.hasAcceptedCurrentVersion(
        session.user.id,
        LEGAL_DOCUMENT_IDS.PRIVACY,
      ),
    ]);

    if (!tosAccepted || !privacyAccepted) {
      redirect("/signup/google/legal-acceptance");
    }

    await userDAL.updateUserStatus(session.user.id, "email_verified");
    if (session.user.image) {
      await userDAL.updateUserProfilePhoto(session.user.id, session.user.image);
    }
    redirect("/join-code");
  } catch (error) {
    // Re-throw redirect errors so Next.js handles them
    if (error && typeof error === "object" && "digest" in error) {
      const redirectError = error as { digest?: string };
      if (redirectError.digest?.startsWith("NEXT_REDIRECT")) {
        throw error;
      }
    }
    console.error("Error in Google signup callback:", error);
    redirect("/signup?error=signup_failed");
  }
}
