import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { userDAL, legalDocumentDAL } from "@/dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import {
  handleApiError,
  parseFormData,
  getClientIP,
  getUserAgent,
  getAuthenticatedUserResponse,
} from "@/lib/api/route-helpers";
import { getSession } from "@/features/auth/utils/session";

async function postHandler(request: NextRequest) {
  try {
    const body = await parseFormData(request);
    const tosAccepted =
      body.tosAccepted === "true" || body.tosAccepted === true;
    const privacyAccepted =
      body.privacyAccepted === "true" || body.privacyAccepted === true;

    // Validate that required documents are accepted
    if (!tosAccepted || !privacyAccepted) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You must accept the Terms of Service and Privacy Policy to continue.",
        },
        { status: 400 },
      );
    }

    // Authenticate user
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    // Get current document versions
    const documentVersions = await legalDocumentDAL.getAllCurrentVersions();

    // Get IP address and user agent from request
    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);

    // Record legal document acceptances
    const acceptancePromises = [];

    if (documentVersions[LEGAL_DOCUMENT_IDS.TOS]) {
      const tosVersion = documentVersions[LEGAL_DOCUMENT_IDS.TOS];
      acceptancePromises.push(
        legalDocumentDAL.recordAcceptance(
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
        legalDocumentDAL.recordAcceptance(
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
    // Get Better Auth session for OAuth-specific image data
    const session = await getSession();
    if (session?.user?.image) {
      await userDAL.updateUserProfilePhoto(userId, session.user.image);
    }

    // Success! Return redirect URL
    return NextResponse.json({
      success: true,
      redirect: "/join-code",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/auth/accept-legal-documents",
);
