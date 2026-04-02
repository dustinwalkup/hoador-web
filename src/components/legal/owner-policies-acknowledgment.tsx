"use client";

import Link from "next/link";
import { ExternalLink, FileText, Info } from "lucide-react";
import type { Control, FieldValues, Path } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  LEGAL_DOCUMENT_IDS,
  LEGAL_DOCUMENT_METADATA,
} from "@/constants/legal-documents";
import type { CurrentDocumentVersion } from "@/dal/types";

/** CMS or static URLs for the two owner policy documents. */
export interface OwnerPolicyDocuments {
  safetyLiabilityPackage?: CurrentDocumentVersion | null;
  prohibitedItemsAndListingContent?: CurrentDocumentVersion | null;
}

const DOCUMENT_PDF_MAP: Record<string, string> = {
  [LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE]:
    "/documents/safety-and-liability-package.pdf",
  [LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT]:
    "/documents/prohibited-items-and-listing-content-policy.pdf",
};

const DOCUMENT_SUMMARIES: Record<string, string> = {
  [LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE]:
    "This comprehensive package combines safety responsibilities, tool condition standards, and liability policies. It covers your responsibilities as a tool owner, including liability for damages, loss coverage, tool condition requirements, safety information you must provide to renters, and how disputes are handled.",
  [LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT]:
    "This policy outlines prohibited items that cannot be listed on the platform and the rules governing listing content, including accurate descriptions and intellectual property requirements.",
};

const DOCUMENT_IDS = [
  LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE,
  LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT,
] as const;

/**
 * Resolves the PDF URL from server document versions or static fallbacks.
 *
 * @param documentId - Legal document id constant
 * @param ownerPolicyDocuments - Optional CMS versions with URLs
 * @returns URL string for the document
 */
export function getOwnerPolicyDocumentUrl(
  documentId: string,
  ownerPolicyDocuments?: OwnerPolicyDocuments,
): string {
  if (documentId === LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE) {
    return (
      ownerPolicyDocuments?.safetyLiabilityPackage?.url ??
      DOCUMENT_PDF_MAP[documentId] ??
      "#"
    );
  }
  if (documentId === LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT) {
    return (
      ownerPolicyDocuments?.prohibitedItemsAndListingContent?.url ??
      DOCUMENT_PDF_MAP[documentId] ??
      "#"
    );
  }
  return DOCUMENT_PDF_MAP[documentId] ?? "#";
}

interface DocumentModalProps {
  metadata: { name: string; category: string };
  summary: string;
  pdfUrl: string;
}

function OwnerPolicyDocumentModal({
  metadata,
  summary,
  pdfUrl,
}: DocumentModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-primary flex w-full items-center gap-2 text-sm hover:underline"
        >
          <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
          <span>{metadata.name}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="scrollbar-hover-reveal max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{metadata.name}</DialogTitle>
          <DialogDescription>{metadata.category}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {summary}
          </p>
          <iframe
            src={pdfUrl}
            title={metadata.name}
            className="h-[min(70vh,600px)] w-full rounded-md border"
          />
          <Link
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-2 text-sm hover:underline"
          >
            <span>View full document</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export interface OwnerPoliciesAcknowledgmentProps<T extends FieldValues> {
  control: Control<T>;
  /** Form field for the required owner-policies checkbox (must validate to true upstream). */
  fieldName: Path<T>;
  /** Copy variant for rental listings (owner) or service listings (provider). */
  listingType?: "rental" | "service";
  ownerPolicyDocuments?: OwnerPolicyDocuments;
  /** When true, shows admin review notice below the checkbox. */
  showAdminReviewCallout?: boolean;
  /** Body copy under the section title. */
  introText?: string;
  /** Custom admin review message (default is tool-listing oriented). */
  adminReviewMessage?: string;
  className?: string;
  /** Stable id for checkbox and label (a11y + tests). */
  checkboxId?: string;
}

const DEFAULT_INTRO =
  "Please review the following policies before creating your listing.";

const DEFAULT_ADMIN_REVIEW =
  "Your listing will be reviewed by an admin before being published. You'll receive a notification once it's approved.";

/**
 * Owner Policies: two policy modals (PDF in dialog + open-in-new-tab link), required acknowledgment checkbox, optional admin review alert.
 */
export function OwnerPoliciesAcknowledgment<T extends FieldValues>({
  control,
  fieldName,
  listingType = "rental",
  ownerPolicyDocuments,
  showAdminReviewCallout = false,
  introText = DEFAULT_INTRO,
  adminReviewMessage = DEFAULT_ADMIN_REVIEW,
  className,
  checkboxId = "ownerPoliciesAcknowledged",
}: OwnerPoliciesAcknowledgmentProps<T>) {
  const policyRole = listingType === "service" ? "Provider" : "Owner";
  const policiesTitle = `${policyRole} Policies`;
  const acknowledgmentCopy = `I have read and agree to the ${policiesTitle} listed above.`;

  const documentNames = DOCUMENT_IDS.map(
    (id) => LEGAL_DOCUMENT_METADATA[id]?.name || id,
  );

  return (
    <div className={className ?? "space-y-6 p-4"}>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">{policiesTitle}</h3>
        <p className="text-muted-foreground text-sm">{introText}</p>
      </div>

      <ul className="space-y-2">
        {DOCUMENT_IDS.map((documentId) => {
          const metadata = LEGAL_DOCUMENT_METADATA[documentId];
          if (!metadata) return null;
          const summary = DOCUMENT_SUMMARIES[documentId];
          const pdfUrl = getOwnerPolicyDocumentUrl(
            documentId,
            ownerPolicyDocuments,
          );

          return (
            <li key={documentId}>
              <OwnerPolicyDocumentModal
                metadata={metadata}
                summary={summary}
                pdfUrl={pdfUrl}
              />
            </li>
          );
        })}
      </ul>

      <FormField
        control={control}
        name={fieldName}
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-y-0 space-x-3">
            <FormControl>
              <Checkbox
                id={checkboxId}
                aria-label={acknowledgmentCopy}
                checked={field.value}
                onCheckedChange={field.onChange}
                className="mt-0.5"
              />
            </FormControl>
            <div className="flex-1 space-y-1 leading-none">
              <FormLabel
                htmlFor={checkboxId}
                className="cursor-pointer text-sm font-medium"
              >
                {acknowledgmentCopy}
              </FormLabel>
              <p className="text-muted-foreground text-xs">
                This includes:{" "}
                {documentNames.map((name, index) => (
                  <span key={name}>
                    <Link
                      href={getOwnerPolicyDocumentUrl(
                        DOCUMENT_IDS[index],
                        ownerPolicyDocuments,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {name}
                    </Link>
                    {index < documentNames.length - 1 && ", "}
                  </span>
                ))}
                .
              </p>
              <FormMessage />
            </div>
          </FormItem>
        )}
      />

      {showAdminReviewCallout ? (
        <Alert className="bg-primary/10">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-primary">
            {adminReviewMessage}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
