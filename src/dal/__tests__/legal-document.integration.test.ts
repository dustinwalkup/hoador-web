import { describe, it, expect } from "vitest";

/**
 * The two reads behind `GET /api/legal-documents` (mobile P-E14-1), against a
 * REAL Postgres: the mocked DAL suite can't tell whether the filters and the
 * ordering are right.
 */

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { legalDocumentDAL } from "@/dal";
import { createUser } from "@/test/integration/factories";

const { legalDocuments, userLegalAcceptances } = schema;

const publish = (id: string, version: string, publishedAt: string) =>
  db.insert(legalDocuments).values({
    id,
    version,
    publishedAt: new Date(publishedAt),
    url: `https://blob.example.com/${id}-${version}.pdf`,
  });

const accept = (
  userId: string,
  documentId: string,
  version: string,
  acceptedAt: string,
) =>
  db.insert(userLegalAcceptances).values({
    userId,
    documentId,
    version,
    acceptedAt: new Date(acceptedAt),
    ipAddress: "203.0.113.7",
    userAgent: "LeakyAgent/1.0",
    method: "rental_checkout",
  });

describe("LegalDocumentDAL reads for the settings list (real DB)", () => {
  it("getAllDocumentVersions returns every version, newest first", async () => {
    await publish("tos", "1.0", "2026-09-01T00:00:00Z");
    await publish("privacy", "1.0", "2026-09-02T00:00:00Z");
    await publish("tos", "1.1", "2026-09-10T00:00:00Z");

    const versions = await legalDocumentDAL.getAllDocumentVersions();

    expect(versions.map((v) => `${v.id}@${v.version}`)).toEqual([
      "tos@1.1",
      "privacy@1.0",
      "tos@1.0",
    ]);
    expect(Object.keys(versions[0]).sort()).toEqual([
      "id",
      "publishedAt",
      "url",
      "version",
    ]);
  });

  it("getAcceptancesForDocuments returns only this user's rows for the asked documents, newest first", async () => {
    const me = await createUser();
    const other = await createUser();
    await accept(me.id, "tos", "1.0", "2026-09-02T00:00:00Z");
    await accept(me.id, "tos", "1.1", "2026-09-11T00:00:00Z");
    await accept(me.id, "cancellation_refund", "1.0", "2026-09-05T00:00:00Z");
    await accept(me.id, "per_rental_agreement", "1.0", "2026-09-06T00:00:00Z");
    await accept(other.id, "tos", "1.1", "2026-09-12T00:00:00Z");

    const rows = await legalDocumentDAL.getAcceptancesForDocuments(me.id, [
      "tos",
      "cancellation_refund",
    ]);

    expect(rows).toEqual([
      {
        documentId: "tos",
        version: "1.1",
        acceptedAt: new Date("2026-09-11T00:00:00Z"),
      },
      {
        documentId: "cancellation_refund",
        version: "1.0",
        acceptedAt: new Date("2026-09-05T00:00:00Z"),
      },
      {
        documentId: "tos",
        version: "1.0",
        acceptedAt: new Date("2026-09-02T00:00:00Z"),
      },
    ]);
    // Never the audit columns.
    expect(JSON.stringify(rows)).not.toContain("203.0.113.7");
  });

  it("getAcceptancesForDocuments returns [] for an empty document list", async () => {
    const me = await createUser();
    await accept(me.id, "tos", "1.0", "2026-09-02T00:00:00Z");

    expect(
      await legalDocumentDAL.getAcceptancesForDocuments(me.id, []),
    ).toEqual([]);
  });
});
