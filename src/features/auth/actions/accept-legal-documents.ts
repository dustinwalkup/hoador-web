"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { LegalDocumentDAL } from "@/dal/legal-document.dal";
import { userDAL } from "@/dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { getSession } from "../utils/session";

type AcceptLegalDocumentsResult = {
  success: boolean;
  error?: string;
};

export async function acceptLegalDocumentsAction(
  prevState: AcceptLegalDocumentsResult | null,
  formData: FormData,
): Promise<AcceptLegalDocumentsResult> {
  const tosAccepted = formData.get("tosAccepted") === "true";
  const privacyAccepted = formData.get("privacyAccepted") === "true";

  // Validate that required documents are accepted
  if (!tosAccepted || !privacyAccepted) {
    return {
      success: false,
      error:
        "You must accept the Terms of Service and Privacy Policy to continue.",
    };
  }

  // Get current user session
  const session = await getSession();
  if (!session?.user) {
    return {
      success: false,
      error: "You must be logged in to accept legal documents.",
    };
  }

  const userId = session.user.id;

  // Get current document versions
  const documentVersions = await LegalDocumentDAL.getAllCurrentVersions();

  // Get IP address and user agent from headers
  const headersList = await headers();
  const ipAddress =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    headersList.get("cf-connecting-ip") ||
    null;
  const userAgent = headersList.get("user-agent") || null;

  try {
    // Record legal document acceptances
    const acceptancePromises = [];

    if (documentVersions[LEGAL_DOCUMENT_IDS.TOS]) {
      const tosVersion = documentVersions[LEGAL_DOCUMENT_IDS.TOS];
      acceptancePromises.push(
        LegalDocumentDAL.recordAcceptance(
          userId,
          LEGAL_DOCUMENT_IDS.TOS,
          tosVersion.version,
          ipAddress,
          userAgent,
          "oauth_google",
        ),
      );
    }

    if (documentVersions[LEGAL_DOCUMENT_IDS.PRIVACY]) {
      const privacyVersion = documentVersions[LEGAL_DOCUMENT_IDS.PRIVACY];
      acceptancePromises.push(
        LegalDocumentDAL.recordAcceptance(
          userId,
          LEGAL_DOCUMENT_IDS.PRIVACY,
          privacyVersion.version,
          ipAddress,
          userAgent,
          "oauth_google",
        ),
      );
    }

    // Wait for all acceptances to be recorded
    await Promise.all(acceptancePromises);

    // Update user table with accepted versions
    await userDAL.updateLegalAcceptances(userId, {
      tosVersion: documentVersions[LEGAL_DOCUMENT_IDS.TOS]?.version,
      tosAcceptedAt: new Date(),
      privacyVersion: documentVersions[LEGAL_DOCUMENT_IDS.PRIVACY]?.version,
      privacyAcceptedAt: new Date(),
    });

    // Update user status from pending_verification to email_verified
    // This is necessary so middleware allows access to /join-code
    const userProfile = await userDAL.getUserById(userId);
    if (userProfile.status === "pending_verification") {
      await userDAL.updateUserStatus(userId, "email_verified");
    }

    // Set user profile photo if available from Google OAuth
    if (session.user.image) {
      await userDAL.updateUserProfilePhoto(userId, session.user.image);
    }

    // Redirect directly to join-code page
    redirect("/join-code");
  } catch (error) {
    // Check if this is a redirect error - if so, re-throw it
    // Next.js redirect() throws a special error that should propagate
    if (error && typeof error === "object" && "digest" in error) {
      const redirectError = error as { digest?: string };
      if (redirectError.digest?.startsWith("NEXT_REDIRECT")) {
        throw error;
      }
    }
    console.error("Error recording legal document acceptances:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to record legal document acceptances. Please try again.",
    };
  }
}
