import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { legalDocumentDAL } from "@/dal/legal-document.dal";
import {
  LEGAL_DOCUMENT_IDS,
  getDocumentName,
} from "@/constants/legal-documents";
import { tryCatch } from "@walkup/walkup-utils";

const COPYRIGHT = `© ${new Date().getFullYear()} Hoador, Inc. All rights reserved`;

interface FooterLinkProps {
  href: string;
  children: React.ReactNode;
  isExternal?: boolean;
}

function FooterLink({ href, children, isExternal = false }: FooterLinkProps) {
  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
      >
        {children}
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
    >
      {children}
    </Link>
  );
}

interface FooterSectionProps {
  title: string;
  children: React.ReactNode;
}

function FooterSection({ title, children }: FooterSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-foreground text-sm font-semibold">{title}</h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

export default async function Footer() {
  // Fetch all current legal document versions
  const { data: documentVersions, error } = await tryCatch(
    legalDocumentDAL.getAllCurrentVersions(),
  );

  if (error) {
    console.error("Error fetching legal documents for footer:", error);
  }

  const documents = documentVersions || {};

  // Helper function to get document URL safely
  const getDocumentUrl = (documentId: string) => {
    return documents[documentId]?.url;
  };

  // Helper function to check if document exists
  const hasDocument = (documentId: string) => {
    return !!getDocumentUrl(documentId);
  };

  return (
    <footer className="bg-muted/40 border-t">
      <div className="mobile-padding container mx-auto py-8 md:max-w-none md:pl-64">
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
                  {getDocumentName(LEGAL_DOCUMENT_IDS.TOS)}
                </FooterLink>
              </li>
            )}
            {hasDocument(LEGAL_DOCUMENT_IDS.PRIVACY) && (
              <li>
                <FooterLink
                  href={getDocumentUrl(LEGAL_DOCUMENT_IDS.PRIVACY)!}
                  isExternal
                >
                  {getDocumentName(LEGAL_DOCUMENT_IDS.PRIVACY)}
                </FooterLink>
              </li>
            )}
            {hasDocument(LEGAL_DOCUMENT_IDS.COMMUNITY) && (
              <li>
                <FooterLink
                  href={getDocumentUrl(LEGAL_DOCUMENT_IDS.COMMUNITY)!}
                  isExternal
                >
                  {getDocumentName(LEGAL_DOCUMENT_IDS.COMMUNITY)}
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
                  {getDocumentName(LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND)}
                </FooterLink>
              </li>
            )}
            {hasDocument(LEGAL_DOCUMENT_IDS.SAFETY_DISCLAIMER) && (
              <li>
                <FooterLink
                  href={getDocumentUrl(LEGAL_DOCUMENT_IDS.SAFETY_DISCLAIMER)!}
                  isExternal
                >
                  Safety Guidelines
                </FooterLink>
              </li>
            )}
            {hasDocument(LEGAL_DOCUMENT_IDS.DAMAGE_LOSS_LIABILITY) && (
              <li>
                <FooterLink
                  href={
                    getDocumentUrl(LEGAL_DOCUMENT_IDS.DAMAGE_LOSS_LIABILITY)!
                  }
                  isExternal
                >
                  Damage & Liability
                </FooterLink>
              </li>
            )}
            {hasDocument(LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS) && (
              <li>
                <FooterLink
                  href={getDocumentUrl(LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS)!}
                  isExternal
                >
                  Payments & Fees
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
        <div className="flex flex-col items-center justify-center gap-4 border-t pt-8 md:flex-row md:justify-center md:gap-6">
          <Image
            src="/hoador-logo.svg"
            alt="Hoador logo"
            width={120}
            height={40}
            className="h-8 w-auto"
          />
          <p className="text-muted-foreground text-sm">{COPYRIGHT}</p>
        </div>
      </div>
    </footer>
  );
}
