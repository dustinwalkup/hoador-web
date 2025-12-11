import { redirect } from "next/navigation";
import { LegalDocumentDAL } from "@/dal/legal-document.dal";
import { userDAL } from "@/dal";
import { getSession } from "@/features/auth/utils/session";
import { LegalDocumentsAcceptanceScreen } from "@/features/auth/components/legal-documents-acceptance-screen";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthLayoutWrapper } from "@/features/auth/components/auth-layout-wrapper";

export default async function LegalAcceptancePage() {
  // Get authenticated user session
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const userId = session.user.id;

  // Check if user has already accepted all documents
  const [tosAccepted, privacyAccepted, communityAccepted] = await Promise.all([
    LegalDocumentDAL.hasAcceptedCurrentVersion(userId, LEGAL_DOCUMENT_IDS.TOS),
    LegalDocumentDAL.hasAcceptedCurrentVersion(
      userId,
      LEGAL_DOCUMENT_IDS.PRIVACY,
    ),
    LegalDocumentDAL.hasAcceptedCurrentVersion(
      userId,
      LEGAL_DOCUMENT_IDS.COMMUNITY,
    ),
  ]);

  // If all documents are accepted, redirect to next step
  if (tosAccepted && privacyAccepted && communityAccepted) {
    redirect("/join-code");
  }

  // Get user profile for first name
  const userProfile = await userDAL.getUserById(userId);
  const firstName = userProfile.firstName || userProfile.name.split(" ")[0];

  // Fetch current document URLs
  const documentVersions = await LegalDocumentDAL.getAllCurrentVersions();

  const documentUrls = {
    tos: documentVersions[LEGAL_DOCUMENT_IDS.TOS]?.url || "",
    privacy: documentVersions[LEGAL_DOCUMENT_IDS.PRIVACY]?.url || "",
    community: documentVersions[LEGAL_DOCUMENT_IDS.COMMUNITY]?.url || "",
  };

  return (
    <AuthLayoutWrapper>
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="pt-4">
          <CardTitle className="text-2xl">Legal Documents</CardTitle>
        </CardHeader>
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
