import { desc, eq, and } from "drizzle-orm";
import { tryCatch } from "@walkup/walkup-utils";

import { db } from "@/db/db";
import {
  legalDocuments,
  userLegalAcceptances,
} from "@/db/schemas/legal-documents.schema";
import { BaseDAL } from "./base";
import { UnauthorizedError } from "./errors";
import { requireAuth } from "@/features/auth/utils/session";
import type { LegalDocumentId } from "@/constants/legal-documents";

export interface CurrentDocumentVersion {
  id: string;
  version: string;
  url: string;
  publishedAt: Date;
}

export interface DocumentVersionsMap {
  [documentId: string]: CurrentDocumentVersion;
}

export interface LegalAcceptance {
  id: string;
  userId: string;
  documentId: string;
  version: string;
  acceptedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  method: string;
}

export class LegalDocumentDAL extends BaseDAL {
  /**
   * Get the latest published version of a specific document
   */
  static async getCurrentVersion(
    documentId: LegalDocumentId,
  ): Promise<CurrentDocumentVersion | null> {
    try {
      const documents = await db
        .select()
        .from(legalDocuments)
        .where(eq(legalDocuments.id, documentId))
        .orderBy(desc(legalDocuments.publishedAt))
        .limit(1);

      const document = documents[0];

      if (!document) {
        return null;
      }

      return {
        id: document.id,
        version: document.version,
        url: document.url,
        publishedAt: document.publishedAt,
      };
    } catch (error) {
      console.error("Error fetching current document version:", error);
      throw error;
    }
  }

  /**
   * Get all current document versions
   * Returns a map of documentId -> current version info
   */
  static async getAllCurrentVersions(): Promise<DocumentVersionsMap> {
    try {
      const allDocuments = await db
        .select()
        .from(legalDocuments)
        .orderBy(desc(legalDocuments.publishedAt));

      // Group by document ID and take the latest version for each
      const versionsMap: DocumentVersionsMap = {};

      for (const doc of allDocuments) {
        // If we haven't seen this document ID yet, or this version is newer
        if (
          !versionsMap[doc.id] ||
          doc.publishedAt > versionsMap[doc.id].publishedAt
        ) {
          versionsMap[doc.id] = {
            id: doc.id,
            version: doc.version,
            url: doc.url,
            publishedAt: doc.publishedAt,
          };
        }
      }

      return versionsMap;
    } catch (error) {
      console.error("Error fetching all current document versions:", error);
      throw error;
    }
  }

  /**
   * Create a new document version (admin method)
   */
  static async createVersion(
    documentId: LegalDocumentId,
    version: string,
    url: string,
  ): Promise<CurrentDocumentVersion> {
    // Require authentication (admin check should be done at service/action level)
    await requireAuth();

    const { data, error } = await tryCatch(
      db
        .insert(legalDocuments)
        .values({
          id: documentId,
          version,
          url,
          publishedAt: new Date(),
        })
        .returning(),
    );

    if (error) {
      console.error("Error creating document version:", error);
      throw error;
    }

    const newVersion = data[0];
    return {
      id: newVersion.id,
      version: newVersion.version,
      url: newVersion.url,
      publishedAt: newVersion.publishedAt,
    };
  }

  /**
   * Record a user's acceptance of a legal document
   */
  static async recordAcceptance(
    userId: string,
    documentId: LegalDocumentId,
    version: string,
    ipAddress: string | null,
    userAgent: string | null,
    method: string,
  ): Promise<void> {
    // Verify authentication and that userId matches authenticated user
    const auth = await requireAuth();
    if (auth.id !== userId) {
      throw new UnauthorizedError("Cannot record acceptance for another user");
    }

    const { error } = await tryCatch(
      db.insert(userLegalAcceptances).values({
        userId,
        documentId,
        version,
        ipAddress,
        userAgent,
        method,
        acceptedAt: new Date(),
      }),
    );

    if (error) {
      console.error("Error recording legal acceptance:", error);
      throw error;
    }
  }

  /**
   * Check if user has accepted the current version of a document
   */
  static async hasAcceptedCurrentVersion(
    userId: string,
    documentId: LegalDocumentId,
  ): Promise<boolean> {
    try {
      // Verify authentication and that userId matches authenticated user
      const auth = await requireAuth();
      if (auth.id !== userId) {
        throw new UnauthorizedError(
          "Cannot check acceptance status for another user",
        );
      }

      // Get current version
      const currentVersion = await this.getCurrentVersion(documentId);

      if (!currentVersion) {
        // No version exists, consider it not accepted
        return false;
      }

      // Check if user has accepted this specific version
      const acceptances = await db
        .select()
        .from(userLegalAcceptances)
        .where(
          and(
            eq(userLegalAcceptances.userId, userId),
            eq(userLegalAcceptances.documentId, documentId),
            eq(userLegalAcceptances.version, currentVersion.version),
          ),
        )
        .limit(1);

      const acceptance = acceptances[0];

      return !!acceptance;
    } catch (error) {
      console.error("Error checking document acceptance:", error);
      throw error;
    }
  }

  /**
   * Get all acceptances for a user
   */
  static async getUserAcceptances(userId: string): Promise<LegalAcceptance[]> {
    try {
      // Verify authentication and that userId matches authenticated user
      const auth = await requireAuth();
      if (auth.id !== userId) {
        throw new UnauthorizedError(
          "Cannot fetch acceptances for another user",
        );
      }

      const acceptances = await db
        .select()
        .from(userLegalAcceptances)
        .where(eq(userLegalAcceptances.userId, userId))
        .orderBy(desc(userLegalAcceptances.acceptedAt));

      return acceptances.map((acc) => ({
        id: acc.id,
        userId: acc.userId,
        documentId: acc.documentId,
        version: acc.version,
        acceptedAt: acc.acceptedAt,
        ipAddress: acc.ipAddress,
        userAgent: acc.userAgent,
        method: acc.method,
      }));
    } catch (error) {
      console.error("Error fetching user acceptances:", error);
      throw error;
    }
  }
}
