"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { tryCatch } from "@walkup/walkup-utils";
import { auth } from "@/services/better-auth";
import { userDAL } from "@/dal";
import { LegalDocumentDAL } from "@/dal/legal-document.dal";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { emailSignupSchema } from "../schemas/auth-schemas";

type SignupResult = {
  success: boolean;
  error?: string;
};

export async function signupAction(
  prevState: SignupResult | null,
  formData: FormData,
): Promise<SignupResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const legalAccepted = formData.get("legalAccepted") === "true";
  // Also check for legacy format (from forms that send both separately)
  const tosAccepted = formData.get("tosAccepted") === "true";
  const privacyAccepted = formData.get("privacyAccepted") === "true";

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
    return {
      success: false,
      error: "Please check your information and try again.",
    };
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
      return {
        success: false,
        error:
          "An account with this email already exists. Please sign in instead.",
      };
    }

    return {
      success: false,
      error: "Failed to create account. Please try again.",
    };
  }

  if (!authResult?.user) {
    return {
      success: false,
      error: "Failed to create account. Please try again.",
    };
  }

  const userId = authResult.user.id;

  // Only record legal acceptances if user accepted them
  if (legalDocumentsAccepted) {
    try {
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

      // Record legal document acceptances (both TOS and Privacy when legalAccepted is true)
      const acceptancePromises = [];

      if (documentVersions[LEGAL_DOCUMENT_IDS.TOS]) {
        const tosVersion = documentVersions[LEGAL_DOCUMENT_IDS.TOS];
        acceptancePromises.push(
          LegalDocumentDAL.recordAcceptanceForSignup(
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
          LegalDocumentDAL.recordAcceptanceForSignup(
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
      console.error(
        "Error stack:",
        error instanceof Error ? error.stack : "No stack",
      );
      // Note: User account is already created, but legal acceptances failed
      // This is a non-critical error - user can continue, but acceptances weren't recorded
      // In production, you might want to log this for manual follow-up
    }
  } else {
    console.error("Legal documents not accepted, skipping recording");
  }

  // Success! Better Auth handles user creation completely
  // Redirect to verify email with email parameter
  redirect(`/verify-email?email=${encodeURIComponent(email)}`);
}
