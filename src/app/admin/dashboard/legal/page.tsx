export const dynamic = "force-dynamic";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { legalDocumentDAL } from "@/dal";
import {
  LEGAL_DOCUMENT_IDS,
  LEGAL_DOCUMENT_CATEGORIES,
  LEGAL_DOCUMENT_METADATA,
  getDocumentsByCategory,
} from "@/constants/legal-documents";
import { LegalDocumentUploadForm } from "@/features/admin/components/legal-document-upload-form";
import { DocumentVersionCard } from "@/features/admin/components/document-version-card";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Admin - Legal Documents",
  description: "Manage legal documents and policies",
};

export default async function LegalDocumentsPage() {
  // Fetch all current document versions
  const currentVersions = await legalDocumentDAL.getAllCurrentVersions();

  // Fetch version history for all documents
  const versionHistories = await Promise.all(
    Object.values(LEGAL_DOCUMENT_IDS).map(async (documentId) => {
      const versions = await legalDocumentDAL.getAllVersions(documentId);
      return { documentId, versions };
    }),
  );

  const versionHistoryMap = new Map(
    versionHistories.map(({ documentId, versions }) => [documentId, versions]),
  );

  return (
    <div className="page-container">
      <PageHeader
        title="Legal Documents"
        description="Manage legal documents and policies"
      />

      {/* Upload Form */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Upload New Document Version</CardTitle>
          <CardDescription className="text-sm">
            Upload a new version of a legal document. All documents are stored
            as PDFs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LegalDocumentUploadForm />
        </CardContent>
      </Card>

      {/* Documents by Category */}
      {Object.values(LEGAL_DOCUMENT_CATEGORIES).map((category) => {
        const documentIds = getDocumentsByCategory(category);
        const documents = documentIds
          .map((id) => {
            const metadata = LEGAL_DOCUMENT_METADATA[id];
            if (!metadata) return null;
            return {
              id,
              metadata,
              currentVersion: currentVersions[id] || null,
              versions: versionHistoryMap.get(id) || [],
            };
          })
          .filter((doc): doc is NonNullable<typeof doc> => doc !== null);

        return (
          <Card key={category}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{category}</CardTitle>
              <CardDescription className="text-sm">
                {documents.length} document{documents.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {documents.map((doc) => {
                  const hasCurrentVersion = !!doc.currentVersion;
                  const isPublished = hasCurrentVersion;

                  return (
                    <DocumentVersionCard
                      key={doc.id}
                      documentId={doc.id}
                      metadata={doc.metadata}
                      currentVersion={doc.currentVersion}
                      versions={doc.versions}
                      isPublished={isPublished}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
