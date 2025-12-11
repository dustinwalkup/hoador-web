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
  const communityAccepted = formData.get("communityAccepted") === "true";

  // Validate that all documents are accepted
  if (!tosAccepted || !privacyAccepted || !communityAccepted) {
    return {
      success: false,
      error: "You must accept all legal documents to continue.",
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

  if (documentVersions[LEGAL_DOCUMENT_IDS.COMMUNITY]) {
    const communityVersion = documentVersions[LEGAL_DOCUMENT_IDS.COMMUNITY];
    acceptancePromises.push(
      LegalDocumentDAL.recordAcceptance(
        userId,
        LEGAL_DOCUMENT_IDS.COMMUNITY,
        communityVersion.version,
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
    communityVersion: documentVersions[LEGAL_DOCUMENT_IDS.COMMUNITY]?.version,
    communityAcceptedAt: new Date(),
  });

  // Redirect to join-code page (next step in onboarding)
  redirect("/join-code");
}
