/**
 * Legal document ID constants for type safety
 */
export const LEGAL_DOCUMENT_IDS = {
  TOS: "tos",
  PRIVACY: "privacy",
  COMMUNITY: "community",
} as const;

export type LegalDocumentId =
  (typeof LEGAL_DOCUMENT_IDS)[keyof typeof LEGAL_DOCUMENT_IDS];
