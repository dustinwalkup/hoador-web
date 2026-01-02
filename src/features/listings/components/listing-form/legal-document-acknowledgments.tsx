"use client";

import Link from "next/link";
import { FileText, ExternalLink } from "lucide-react";
import { Control } from "react-hook-form";

import {
  FormField,
  FormItem,
  FormControl,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  LEGAL_DOCUMENT_IDS,
  LEGAL_DOCUMENT_METADATA,
} from "@/constants/legal-documents";
import type { CreateListingFormDataClientType } from "@/features/listings/form-schema/listing.schema";

// Map document IDs to PDF filenames
const DOCUMENT_PDF_MAP: Record<string, string> = {
  [LEGAL_DOCUMENT_IDS.DAMAGE_LOSS_LIABILITY]:
    "/documents/damage-lost-and-liability-policy.pdf",
  [LEGAL_DOCUMENT_IDS.TOOL_CONDITION_STANDARDS]:
    "/documents/listing-condition-standards.pdf",
  [LEGAL_DOCUMENT_IDS.SAFETY_DISCLAIMER]: "/documents/safety-disclaimer.pdf",
  [LEGAL_DOCUMENT_IDS.LISTING_CONTENT_RULES]:
    "/documents/ip-listing-content-rules.pdf",
};

// Document summaries (placeholders)
const DOCUMENT_SUMMARIES: Record<string, string> = {
  [LEGAL_DOCUMENT_IDS.DAMAGE_LOSS_LIABILITY]:
    "This policy outlines your responsibilities as a tool owner, including liability for damages, loss coverage, and insurance requirements. It details how disputes are handled and what protections are available.",
  [LEGAL_DOCUMENT_IDS.TOOL_CONDITION_STANDARDS]:
    "This document defines the condition categories (excellent, good, fair, poor) and the standards your tools must meet. It includes inspection requirements and condition reporting guidelines.",
  [LEGAL_DOCUMENT_IDS.SAFETY_DISCLAIMER]:
    "This disclaimer covers safety responsibilities, proper tool usage, and liability limitations. It outlines what safety information you must provide to renters.",
  [LEGAL_DOCUMENT_IDS.LISTING_CONTENT_RULES]:
    "These rules govern what content is allowed in listings, including prohibited items, accurate descriptions, and intellectual property requirements.",
};

// Document IDs in order
const DOCUMENT_IDS = [
  LEGAL_DOCUMENT_IDS.DAMAGE_LOSS_LIABILITY,
  LEGAL_DOCUMENT_IDS.TOOL_CONDITION_STANDARDS,
  LEGAL_DOCUMENT_IDS.SAFETY_DISCLAIMER,
  LEGAL_DOCUMENT_IDS.LISTING_CONTENT_RULES,
] as const;

interface LegalDocumentAcknowledgmentsProps {
  control: Control<CreateListingFormDataClientType>;
}

interface DocumentModalProps {
  metadata: { name: string; category: string };
  summary: string;
  pdfUrl: string;
}

function DocumentModal({ metadata, summary, pdfUrl }: DocumentModalProps) {
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{metadata.name}</DialogTitle>
          <DialogDescription>{metadata.category}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {summary}
          </p>
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

export function LegalDocumentAcknowledgments({
  control,
}: LegalDocumentAcknowledgmentsProps) {
  const documentNames = DOCUMENT_IDS.map(
    (id) => LEGAL_DOCUMENT_METADATA[id].name,
  );

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Owner Policies</h3>
        <p className="text-muted-foreground text-sm">
          Please review the following policies before creating your listing.
        </p>
      </div>

      <ul className="space-y-2">
        {DOCUMENT_IDS.map((documentId) => {
          const metadata = LEGAL_DOCUMENT_METADATA[documentId];
          const summary = DOCUMENT_SUMMARIES[documentId];
          const pdfUrl = DOCUMENT_PDF_MAP[documentId];

          return (
            <li key={documentId}>
              <DocumentModal
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
        name="ownerPoliciesAcknowledged"
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-y-0 space-x-3">
            <FormControl>
              <Checkbox
                id="ownerPoliciesAcknowledged"
                aria-label="I have read and agree to the Owner Policies listed above"
                checked={field.value}
                onCheckedChange={field.onChange}
                className="mt-0.5"
              />
            </FormControl>
            <div className="flex-1 space-y-1 leading-none">
              <FormLabel
                htmlFor="ownerPoliciesAcknowledged"
                className="cursor-pointer text-sm font-medium"
              >
                I have read and agree to the Owner Policies listed above.
              </FormLabel>
              <p className="text-muted-foreground text-xs">
                This includes:{" "}
                {documentNames.map((name, index) => (
                  <span key={name}>
                    <Link
                      href={DOCUMENT_PDF_MAP[DOCUMENT_IDS[index]]}
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
    </div>
  );
}
