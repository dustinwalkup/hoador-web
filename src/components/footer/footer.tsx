import { legalDocumentDAL } from "@/dal/legal-document.dal";
import { tryCatch } from "@walkup/walkup-utils";
import { cn } from "@/lib/utils";
import {
  LEGAL_DOCUMENT_IDS,
  getDocumentName,
  type LegalDocumentId,
} from "@/constants/legal-documents";
import { FooterLink, FooterSection } from "./footer-components";
import { Logo } from "../logo";

const COPYRIGHT = `© ${new Date().getFullYear()} Hoador, Inc. All rights reserved`;

export default async function Footer() {
  // Fetch all current legal document versions
  const { data: documentVersions, error } = await tryCatch(
    legalDocumentDAL.getAllCurrentVersions(),
  );

  if (error) {
    console.error("Error fetching legal documents for footer:", error);
  }

  const documents = documentVersions || {};

  // Create a serializable map of documentId -> url
  const documentUrls: Record<string, string> = {};
  for (const [documentId, document] of Object.entries(documents)) {
    if (document?.url) {
      documentUrls[documentId] = document.url;
    }
  }

  // Helper functions in the client component
  const hasDocument = (documentId: string) => {
    return !!documentUrls?.[documentId];
  };

  const getDocumentUrl = (documentId: string) => {
    return documentUrls?.[documentId];
  };

  return (
    <footer className="bg-muted/40 border-t">
      <div
        className={cn("mobile-padding container mx-auto py-8 md:max-w-[73%]")}
      >
        {/* Links Grid */}
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Legal Section */}
          <FooterSection title="Legal">
            {hasDocument(LEGAL_DOCUMENT_IDS.TOS) && (
              <li>
                <FooterLink
                  href={getDocumentUrl(LEGAL_DOCUMENT_IDS.TOS)!}
                  isExternal
                >
                  {getDocumentName(LEGAL_DOCUMENT_IDS.TOS as LegalDocumentId)}
                </FooterLink>
              </li>
            )}
            {hasDocument(LEGAL_DOCUMENT_IDS.PRIVACY) && (
              <li>
                <FooterLink
                  href={getDocumentUrl(LEGAL_DOCUMENT_IDS.PRIVACY)!}
                  isExternal
                >
                  {getDocumentName(
                    LEGAL_DOCUMENT_IDS.PRIVACY as LegalDocumentId,
                  )}
                </FooterLink>
              </li>
            )}
            {hasDocument(LEGAL_DOCUMENT_IDS.COMMUNITY) && (
              <li>
                <FooterLink
                  href={getDocumentUrl(LEGAL_DOCUMENT_IDS.COMMUNITY)!}
                  isExternal
                >
                  {getDocumentName(
                    LEGAL_DOCUMENT_IDS.COMMUNITY as LegalDocumentId,
                  )}
                </FooterLink>
              </li>
            )}
          </FooterSection>

          {/* Policies Section */}
          <FooterSection title="Policies">
            {hasDocument(LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND) && (
              <li>
                <FooterLink
                  href={getDocumentUrl(LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND)!}
                  isExternal
                >
                  {getDocumentName(
                    LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND as LegalDocumentId,
                  )}
                </FooterLink>
              </li>
            )}
            {hasDocument(LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE) && (
              <li>
                <FooterLink
                  href={
                    getDocumentUrl(LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE)!
                  }
                  isExternal
                >
                  {getDocumentName(
                    LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE as LegalDocumentId,
                  )}
                </FooterLink>
              </li>
            )}
            {hasDocument(LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS) && (
              <li>
                <FooterLink
                  href={getDocumentUrl(LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS)!}
                  isExternal
                >
                  {getDocumentName(
                    LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS as LegalDocumentId,
                  )}
                </FooterLink>
              </li>
            )}
            {hasDocument(
              LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT,
            ) && (
              <li>
                <FooterLink
                  href={
                    getDocumentUrl(
                      LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT,
                    )!
                  }
                  isExternal
                >
                  {getDocumentName(
                    LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT as LegalDocumentId,
                  )}
                </FooterLink>
              </li>
            )}
          </FooterSection>

          {/* Support Section */}
          <FooterSection title="Support">
            <li>
              <FooterLink href="/help">Help Center</FooterLink>
            </li>
            <li>
              <FooterLink href="/help/report">Report an Issue</FooterLink>
            </li>
          </FooterSection>
        </div>

        {/* Logo and Copyright */}
        <div className="flex flex-col items-center justify-center gap-4 border-t pt-8 md:justify-center md:gap-6">
          <Logo
            width={120}
            height={40}
            absolutePosition="-right-14!"
            className="h-8 w-auto"
            showBetaTag
          />
          <p className="text-muted-foreground text-sm">{COPYRIGHT}</p>
        </div>
      </div>
    </footer>
  );
}
