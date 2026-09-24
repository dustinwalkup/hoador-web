import { legalDocumentDAL, userDAL } from "@/dal";
import {
  LEGAL_DOCUMENT_IDS,
  USER_FACING_LEGAL_DOCUMENT_IDS,
  getDocumentName,
} from "@/constants/legal-documents";

export type UserLegalDocument = {
  id: string;
  name: string;
  /** The current (latest published) version. */
  version: string;
  publishedAt: Date;
  url: string;
  /**
   * The user's most recent acceptance of this document, or `null` if none is
   * on record. `url` is that version's PDF, `null` if the version was deleted.
   */
  accepted: { version: string; acceptedAt: Date; url: string | null } | null;
};

/**
 * The signup documents' acceptances live on the user row. Every other
 * acceptance (and a TOS re-accepted at a service checkout) is in
 * `user_legal_acceptances`.
 */
const USER_ROW_ACCEPTANCES = {
  [LEGAL_DOCUMENT_IDS.TOS]: ["tosVersion", "tosAcceptedAt"],
  [LEGAL_DOCUMENT_IDS.PRIVACY]: ["privacyVersion", "privacyAcceptedAt"],
  [LEGAL_DOCUMENT_IDS.COMMUNITY]: ["communityVersion", "communityAcceptedAt"],
} as const;

type Acceptance = { version: string; acceptedAt: Date };

/**
 * The user-facing legal documents with the caller's acceptance of each, in
 * display order. Only published documents are listed, the same rule as web's
 * footer: a document with no version yet is left out.
 *
 * `accepted` is the latest acceptance from any source, so a policy accepted at
 * checkout counts, and "updated since you accepted" is simply
 * `accepted.version !== version`.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-14-profile-settings-account.md (P-E14-1)
 */
export async function listLegalDocumentsForUser(
  userId: string,
): Promise<UserLegalDocument[]> {
  const [versions, profile, acceptances] = await Promise.all([
    legalDocumentDAL.getAllDocumentVersions(),
    userDAL.getUserById(userId),
    legalDocumentDAL.getAcceptancesForDocuments(
      userId,
      USER_FACING_LEGAL_DOCUMENT_IDS,
    ),
  ]);

  const urlOf = (id: string, version: string) =>
    versions.find((v) => v.id === id && v.version === version)?.url ?? null;

  const documents: UserLegalDocument[] = [];
  for (const id of USER_FACING_LEGAL_DOCUMENT_IDS) {
    // `versions` is newest first, so the first match is the current one.
    const current = versions.find((v) => v.id === id);
    if (!current) continue;

    const candidates: Acceptance[] = acceptances.filter(
      (a) => a.documentId === id,
    );
    const userRowKeys =
      USER_ROW_ACCEPTANCES[id as keyof typeof USER_ROW_ACCEPTANCES];
    if (userRowKeys) {
      const [versionKey, atKey] = userRowKeys;
      const version = profile[versionKey];
      const acceptedAt = profile[atKey];
      if (version && acceptedAt) candidates.push({ version, acceptedAt });
    }
    const latest = candidates.reduce<Acceptance | null>(
      (best, a) => (!best || a.acceptedAt > best.acceptedAt ? a : best),
      null,
    );

    documents.push({
      id,
      name: getDocumentName(id),
      version: current.version,
      publishedAt: current.publishedAt,
      url: current.url,
      accepted: latest && {
        version: latest.version,
        acceptedAt: latest.acceptedAt,
        url: urlOf(id, latest.version),
      },
    });
  }
  return documents;
}
