"use client";

import type { Control } from "react-hook-form";

import {
  OwnerPoliciesAcknowledgment,
  type OwnerPolicyDocuments,
} from "@/components/legal/owner-policies-acknowledgment";
import type { CreateListingFormDataClientType } from "@/features/listings/form-schema/listing.schema";

export type { OwnerPolicyDocuments };

interface LegalDocumentAcknowledgmentsProps {
  control: Control<CreateListingFormDataClientType>;
  ownerPolicyDocuments?: OwnerPolicyDocuments;
}

/**
 * Owner policy modals, PDF preview, and acknowledgment checkbox for tool listings.
 * Delegates to shared {@link OwnerPoliciesAcknowledgment}; admin review alert stays on add-listing-form.
 */
export function LegalDocumentAcknowledgments({
  control,
  ownerPolicyDocuments,
}: LegalDocumentAcknowledgmentsProps) {
  return (
    <OwnerPoliciesAcknowledgment
      control={control}
      fieldName="ownerPoliciesAcknowledged"
      ownerPolicyDocuments={ownerPolicyDocuments}
      showAdminReviewCallout={false}
    />
  );
}
