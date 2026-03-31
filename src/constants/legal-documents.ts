/**
 * Legal document ID constants for type safety
 * Organized by category for admin UI display
 */
export const LEGAL_DOCUMENT_IDS = {
  // Core Legal
  TOS: "tos",
  PRIVACY: "privacy",
  PAYMENTS_PAYOUTS: "payments_payouts",

  // Safety / Liability
  // @deprecated - Use SAFETY_LIABILITY_PACKAGE instead. Kept for backward compatibility with existing acceptance records.
  DAMAGE_LOSS_LIABILITY: "damage_loss_liability",
  // @deprecated - Use SAFETY_LIABILITY_PACKAGE instead. Kept for backward compatibility with existing acceptance records.
  TOOL_CONDITION_STANDARDS: "tool_condition_standards",
  // @deprecated - Use SAFETY_LIABILITY_PACKAGE instead. Kept for backward compatibility with existing acceptance records.
  SAFETY_DISCLAIMER: "safety_disclaimer",
  SAFETY_LIABILITY_PACKAGE: "safety_liability_package",

  // Community
  COMMUNITY: "community",
  REVIEW_POLICY: "review_policy",

  // Transactional
  PER_RENTAL_AGREEMENT: "per_rental_agreement",
  PER_SERVICE_AGREEMENT: "per_service_agreement",
  CANCELLATION_REFUND: "cancellation_refund",
  DISPUTE_POLICY: "dispute_policy",

  // Governance
  PROHIBITED_ITEMS: "prohibited_items",
  LISTING_CONTENT_RULES: "listing_content_rules",
  PROHIBITED_ITEMS_AND_LISTING_CONTENT: "prohibited_items_and_listing_content",
} as const;

export type LegalDocumentId =
  (typeof LEGAL_DOCUMENT_IDS)[keyof typeof LEGAL_DOCUMENT_IDS];

/**
 * Document categories for organizing in admin UI
 */
export const LEGAL_DOCUMENT_CATEGORIES = {
  CORE_LEGAL: "Core Legal",
  SAFETY_LIABILITY: "Safety / Liability",
  COMMUNITY: "Community",
  TRANSACTIONAL: "Transactional",
  GOVERNANCE: "Governance",
} as const;

export type LegalDocumentCategory =
  (typeof LEGAL_DOCUMENT_CATEGORIES)[keyof typeof LEGAL_DOCUMENT_CATEGORIES];

/**
 * Document metadata including display name and category
 * Only documents with metadata will appear in the admin UI
 */
export const LEGAL_DOCUMENT_METADATA: Partial<
  Record<LegalDocumentId, { name: string; category: LegalDocumentCategory }>
> = {
  // Core Legal
  [LEGAL_DOCUMENT_IDS.TOS]: {
    name: "Terms of Service",
    category: LEGAL_DOCUMENT_CATEGORIES.CORE_LEGAL,
  },
  [LEGAL_DOCUMENT_IDS.PRIVACY]: {
    name: "Privacy Policy",
    category: LEGAL_DOCUMENT_CATEGORIES.CORE_LEGAL,
  },
  [LEGAL_DOCUMENT_IDS.PAYMENTS_PAYOUTS]: {
    name: "Payments & Payouts Policy",
    category: LEGAL_DOCUMENT_CATEGORIES.CORE_LEGAL,
  },

  // Safety / Liability
  [LEGAL_DOCUMENT_IDS.SAFETY_LIABILITY_PACKAGE]: {
    name: "Safety and Liability Package",
    category: LEGAL_DOCUMENT_CATEGORIES.SAFETY_LIABILITY,
  },

  // Community
  [LEGAL_DOCUMENT_IDS.COMMUNITY]: {
    name: "Community Guidelines",
    category: LEGAL_DOCUMENT_CATEGORIES.COMMUNITY,
  },
  [LEGAL_DOCUMENT_IDS.REVIEW_POLICY]: {
    name: "Review Policy",
    category: LEGAL_DOCUMENT_CATEGORIES.COMMUNITY,
  },

  // Transactional
  [LEGAL_DOCUMENT_IDS.PER_RENTAL_AGREEMENT]: {
    name: "Per-Rental Agreement",
    category: LEGAL_DOCUMENT_CATEGORIES.TRANSACTIONAL,
  },
  [LEGAL_DOCUMENT_IDS.PER_SERVICE_AGREEMENT]: {
    name: "Per-Service Agreement",
    category: LEGAL_DOCUMENT_CATEGORIES.TRANSACTIONAL,
  },
  [LEGAL_DOCUMENT_IDS.CANCELLATION_REFUND]: {
    name: "Cancellation & Refund Policy",
    category: LEGAL_DOCUMENT_CATEGORIES.TRANSACTIONAL,
  },
  [LEGAL_DOCUMENT_IDS.DISPUTE_POLICY]: {
    name: "Dispute Policy",
    category: LEGAL_DOCUMENT_CATEGORIES.TRANSACTIONAL,
  },

  // Governance
  [LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT]: {
    name: "Prohibited Items and Listing Content Policy",
    category: LEGAL_DOCUMENT_CATEGORIES.GOVERNANCE,
  },
};

/**
 * Get all document IDs for a specific category
 */
export function getDocumentsByCategory(
  category: LegalDocumentCategory,
): LegalDocumentId[] {
  return Object.entries(LEGAL_DOCUMENT_METADATA)
    .filter(([, metadata]) => metadata.category === category)
    .map(([id]) => id as LegalDocumentId);
}

/**
 * Get document display name by ID
 */
export function getDocumentName(id: LegalDocumentId): string {
  return LEGAL_DOCUMENT_METADATA[id]?.name || id;
}

/**
 * Get document category by ID
 */
export function getDocumentCategory(
  id: LegalDocumentId,
): LegalDocumentCategory {
  return (
    LEGAL_DOCUMENT_METADATA[id]?.category ||
    LEGAL_DOCUMENT_CATEGORIES.CORE_LEGAL
  );
}
