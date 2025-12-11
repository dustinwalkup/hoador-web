export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { userDAL } from "@/dal";
import { getSession } from "@/features/auth/utils/session";
import { LegalDocumentDAL } from "@/dal/legal-document.dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";

export default async function GoogleSignupCallback() {
  // Get authenticated user session
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  // Check if user has accepted required legal documents
  const [tosAccepted, privacyAccepted] = await Promise.all([
    LegalDocumentDAL.hasAcceptedCurrentVersion(
      session.user.id,
      LEGAL_DOCUMENT_IDS.TOS,
    ),
    LegalDocumentDAL.hasAcceptedCurrentVersion(
      session.user.id,
      LEGAL_DOCUMENT_IDS.PRIVACY,
    ),
  ]);

  // If required documents are not accepted, redirect to legal acceptance page
  // Note: Community Guidelines is optional, so we don't check it here
  if (!tosAccepted || !privacyAccepted) {
    redirect("/signup/google/legal-acceptance");
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
    // Match the middleware routing logic for each status
    if (finalStatus === "active") {
      redirect("/dashboard");
    } else if (finalStatus === "incomplete_profile") {
      redirect("/onboarding");
    } else {
      // email_verified, pending_verification, etc. -> join-code
      redirect("/join-code");
    }
  } catch (error) {
    // Check if this is a redirect error - if so, re-throw it
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
