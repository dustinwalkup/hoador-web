import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { auth } from "@/services/better-auth";
import { userDAL } from "@/dal";
import { legalDocumentDAL } from "@/dal/legal-document.dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { emailSignupSchema } from "@/features/auth/schemas/auth-schemas";
import {
  handleApiError,
  parseFormData,
  getClientIP,
  getUserAgent,
} from "@/lib/api/route-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = await parseFormData(request);

    const email = body.email as string;
    const password = body.password as string;
    const firstName = body.firstName as string;
    const lastName = body.lastName as string;
    const legalAccepted =
      body.legalAccepted === "true" || body.legalAccepted === true;
    // Also check for legacy format (from forms that send both separately)
    const tosAccepted =
      body.tosAccepted === "true" || body.tosAccepted === true;
    const privacyAccepted =
      body.privacyAccepted === "true" || body.privacyAccepted === true;

    // Determine if legal documents are accepted
    // Support both new format (legalAccepted) and legacy format (tosAccepted && privacyAccepted)
    const legalDocumentsAccepted =
      legalAccepted || (tosAccepted && privacyAccepted);

    // Validate form data
    const signupData = {
      email,
      password,
      firstName,
      lastName,
      legalAccepted: legalDocumentsAccepted,
    };

    try {
      emailSignupSchema.parse(signupData);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Please check your information and try again.",
        },
        { status: 400 },
      );
    }

    // Create account with Better Auth
    const { data: authResult, error: authError } = await tryCatch(
      auth.api.signUpEmail({
        body: {
          email,
          password,
          name: `${firstName} ${lastName}`,
        },
      }),
    );

    if (authError) {
      console.error("Better Auth signup error:", authError);

      if (authError.message?.includes("already exists")) {
        return NextResponse.json(
          {
            success: false,
            error:
              "An account with this email already exists. Please sign in instead.",
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create account. Please try again.",
        },
        { status: 500 },
      );
    }

    if (!authResult?.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create account. Please try again.",
        },
        { status: 500 },
      );
    }

    const userId = authResult.user.id;

    // Only record legal acceptances if user accepted them
    if (legalDocumentsAccepted) {
      try {
        // Get current document versions
        const documentVersions = await legalDocumentDAL.getAllCurrentVersions();

        // Get IP address and user agent from request
        const ipAddress = getClientIP(request);
        const userAgent = getUserAgent(request);

        // Record legal document acceptances (both TOS and Privacy when legalAccepted is true)
        const acceptancePromises = [];

        if (documentVersions[LEGAL_DOCUMENT_IDS.TOS]) {
          const tosVersion = documentVersions[LEGAL_DOCUMENT_IDS.TOS];
          acceptancePromises.push(
            legalDocumentDAL.recordAcceptanceForSignup(
              userId,
              LEGAL_DOCUMENT_IDS.TOS,
              tosVersion.version,
              ipAddress,
              userAgent,
              "email",
            ),
          );
        } else {
          console.warn("No TOS document version found");
        }

        if (documentVersions[LEGAL_DOCUMENT_IDS.PRIVACY]) {
          const privacyVersion = documentVersions[LEGAL_DOCUMENT_IDS.PRIVACY];
          acceptancePromises.push(
            legalDocumentDAL.recordAcceptanceForSignup(
              userId,
              LEGAL_DOCUMENT_IDS.PRIVACY,
              privacyVersion.version,
              ipAddress,
              userAgent,
              "email",
            ),
          );
        } else {
          console.warn("No Privacy document version found");
        }

        await Promise.all(acceptancePromises);

        await userDAL.updateLegalAcceptancesForSignup(userId, {
          tosVersion: documentVersions[LEGAL_DOCUMENT_IDS.TOS]?.version,
          tosAcceptedAt: new Date(),
          privacyVersion: documentVersions[LEGAL_DOCUMENT_IDS.PRIVACY]?.version,
          privacyAcceptedAt: new Date(),
        });
      } catch (error) {
        console.error("Error recording legal document acceptances:", error);
        // Note: User account is already created, but legal acceptances failed
        // This is a non-critical error - user can continue, but acceptances weren't recorded
      }
    } else {
      console.error("Legal documents not accepted, skipping recording");
    }

    // Success! Return redirect URL
    return NextResponse.json({
      success: true,
      redirect: `/verify-email?email=${encodeURIComponent(email)}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
