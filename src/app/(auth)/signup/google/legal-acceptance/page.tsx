export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { legalDocumentDAL } from "@/dal/legal-document.dal";
import { userDAL } from "@/dal";
import { getSession } from "@/features/auth/utils/session";
import { LegalDocumentsAcceptanceScreen } from "@/features/auth/components/legal-documents-acceptance-screen";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { Card, CardContent } from "@/components/ui/card";
import { AuthLayoutWrapper } from "@/features/auth/components/auth-layout-wrapper";

export default async function LegalAcceptancePage() {
  // Get authenticated user session
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const userId = session.user.id;

  // Check if user has already accepted required documents
  const [tosAccepted, privacyAccepted] = await Promise.all([
    legalDocumentDAL.hasAcceptedCurrentVersion(userId, LEGAL_DOCUMENT_IDS.TOS),
    legalDocumentDAL.hasAcceptedCurrentVersion(
      userId,
      LEGAL_DOCUMENT_IDS.PRIVACY,
    ),
  ]);

  // If required documents are accepted, redirect to next step
  // Note: Community Guidelines is optional, so we don't check it here
  if (tosAccepted && privacyAccepted) {
    redirect("/join-code");
  }

  // Get user profile for first name
  const userProfile = await userDAL.getUserById(userId);
  const firstName = userProfile.firstName || userProfile.name.split(" ")[0];

  // Fetch current document URLs
  const documentVersions = await legalDocumentDAL.getAllCurrentVersions();

  const documentUrls = {
    tos: documentVersions[LEGAL_DOCUMENT_IDS.TOS]?.url || "",
    privacy: documentVersions[LEGAL_DOCUMENT_IDS.PRIVACY]?.url || "",
  };

  return (
    <AuthLayoutWrapper>
      <Card className="mx-auto w-full max-w-md">
        <CardContent>
          <LegalDocumentsAcceptanceScreen
            firstName={firstName}
            documentUrls={documentUrls}
          />
        </CardContent>
      </Card>
    </AuthLayoutWrapper>
  );
}
