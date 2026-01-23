import { desc, eq, and } from "drizzle-orm";
import { tryCatch } from "@walkup/walkup-utils";

import { db } from "@/db/db";
import {
  legalDocuments,
  userLegalAcceptances,
} from "@/db/schemas/legal-documents.schema";
import { rentalRequests } from "@/db/schemas/rentals.schema";
import { BaseDAL } from "./base";
import {
  type LegalDocumentId,
  LEGAL_DOCUMENT_IDS,
} from "@/constants/legal-documents";
import { deleteFromBlob } from "@/services/vercel-blob";

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
  rentalRequestId: string | null;
  listingId: string | null;
  acceptedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  method: string;
}

export interface DocumentVersion {
  id: string;
  version: string;
  url: string;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class legalDocumentDAL extends BaseDAL {
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
   * Validate document ID against known document IDs
   */
  private static validateDocumentId(
    documentId: string,
  ): documentId is LegalDocumentId {
    return Object.values(LEGAL_DOCUMENT_IDS).includes(
      documentId as LegalDocumentId,
    );
  }

  /**
   * Get all versions of a specific document (not just current)
   */
  static async getAllVersions(
    documentId: LegalDocumentId,
  ): Promise<DocumentVersion[]> {
    try {
      if (!this.validateDocumentId(documentId)) {
        throw new Error(`Invalid document ID: ${documentId}`);
      }

      const versions = await db
        .select()
        .from(legalDocuments)
        .where(eq(legalDocuments.id, documentId))
        .orderBy(desc(legalDocuments.publishedAt));

      return versions.map((doc) => ({
        id: doc.id,
        version: doc.version,
        url: doc.url,
        publishedAt: doc.publishedAt,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }));
    } catch (error) {
      console.error("Error fetching all document versions:", error);
      throw error;
    }
  }

  /**
   * Get version history for a document (sorted by publishedAt, newest first)
   */
  static async getVersionHistory(
    documentId: LegalDocumentId,
  ): Promise<DocumentVersion[]> {
    return this.getAllVersions(documentId);
  }

  /**
   * Get a specific version of a document
   */
  static async getVersion(
    documentId: LegalDocumentId,
    version: string,
  ): Promise<DocumentVersion | null> {
    try {
      if (!this.validateDocumentId(documentId)) {
        throw new Error(`Invalid document ID: ${documentId}`);
      }

      const versions = await db
        .select()
        .from(legalDocuments)
        .where(
          and(
            eq(legalDocuments.id, documentId),
            eq(legalDocuments.version, version),
          ),
        )
        .limit(1);

      if (versions.length === 0) {
        return null;
      }

      const doc = versions[0];
      return {
        id: doc.id,
        version: doc.version,
        url: doc.url,
        publishedAt: doc.publishedAt,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    } catch (error) {
      console.error("Error fetching document version:", error);
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
    if (!this.validateDocumentId(documentId)) {
      throw new Error(`Invalid document ID: ${documentId}`);
    }

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
   * Delete a document version (admin method)
   * Only allows deletion of non-current versions
   */
  static async deleteVersion(
    documentId: LegalDocumentId,
    version: string,
    blobPathname?: string,
  ): Promise<void> {
    if (!this.validateDocumentId(documentId)) {
      throw new Error(`Invalid document ID: ${documentId}`);
    }

    // Get current version to prevent deletion
    const currentVersion = await this.getCurrentVersion(documentId);
    if (currentVersion && currentVersion.version === version) {
      throw new Error(
        "Cannot delete the current version. Upload a new version first.",
      );
    }

    // Get the version to delete
    const versionToDelete = await this.getVersion(documentId, version);
    if (!versionToDelete) {
      throw new Error(
        `Version ${version} not found for document ${documentId}`,
      );
    }

    // Extract pathname from URL if not provided
    let pathname = blobPathname;
    if (!pathname && versionToDelete.url) {
      try {
        const url = new URL(versionToDelete.url);
        pathname = url.pathname.substring(1); // Remove leading slash
      } catch (error) {
        console.warn("Could not parse blob URL for deletion:", error);
      }
    }

    // Delete from database
    const { error: dbError } = await tryCatch(
      db
        .delete(legalDocuments)
        .where(
          and(
            eq(legalDocuments.id, documentId),
            eq(legalDocuments.version, version),
          ),
        ),
    );

    if (dbError) {
      console.error("Error deleting document version from database:", dbError);
      throw dbError;
    }

    // Delete from blob storage (don't fail if this fails)
    if (pathname) {
      try {
        await deleteFromBlob(pathname);
      } catch (error) {
        console.warn("Failed to delete blob file:", pathname, error);
        // Don't throw - database deletion succeeded
      }
    }
  }

  /**
   * Record a user's acceptance of a legal document
   * Requires authentication - use recordAcceptanceForSignup during signup flow
   * @param rentalRequestId Optional rental request ID to tie acceptance to specific rental
   * @param listingId Optional listing ID to tie acceptance to specific listing
   */
  static async recordAcceptance(
    userId: string,
    documentId: LegalDocumentId,
    version: string,
    ipAddress: string | null,
    userAgent: string | null,
    method: string,
    rentalRequestId?: string,
    listingId?: string,
  ): Promise<void> {
    const { error } = await tryCatch(
      db.insert(userLegalAcceptances).values({
        userId,
        documentId,
        version,
        rentalRequestId: rentalRequestId || null,
        listingId: listingId || null,
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
   * Record a user's acceptance of a legal document during signup
   * Does not require authentication - used during signup flow before session exists
   * @param rentalRequestId Optional rental request ID to tie acceptance to specific rental
   */
  static async recordAcceptanceForSignup(
    userId: string,
    documentId: LegalDocumentId,
    version: string,
    ipAddress: string | null,
    userAgent: string | null,
    method: string,
    rentalRequestId?: string,
  ): Promise<void> {
    const { error } = await tryCatch(
      db.insert(userLegalAcceptances).values({
        userId,
        documentId,
        version,
        rentalRequestId: rentalRequestId || null,
        ipAddress,
        userAgent,
        method,
        acceptedAt: new Date(),
      }),
    );

    if (error) {
      console.error("Error recording legal acceptance during signup:", error);
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
        rentalRequestId: acc.rentalRequestId,
        listingId: acc.listingId,
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

  /**
   * Get the rental agreement acceptance for a specific rental request
   * Returns the document version and URL that was accepted at rental creation
   */
  static async getRentalAgreementAcceptance(
    rentalRequestId: string,
    userId: string,
  ): Promise<{ version: string; url: string } | null> {
    try {
      // Verify the rental request exists
      const rentalRequest = await db
        .select()
        .from(rentalRequests)
        .where(eq(rentalRequests.id, rentalRequestId))
        .limit(1);

      if (rentalRequest.length === 0) {
        return null;
      }

      const request = rentalRequest[0];
      // Verify user has access to this rental (is either renter or owner)
      if (request.renterId !== userId && request.ownerId !== userId) {
        return null;
      }

      // Get the acceptance record for this rental request
      const acceptances = await db
        .select()
        .from(userLegalAcceptances)
        .where(
          and(
            eq(userLegalAcceptances.rentalRequestId, rentalRequestId),
            eq(
              userLegalAcceptances.documentId,
              LEGAL_DOCUMENT_IDS.PER_RENTAL_AGREEMENT,
            ),
          ),
        )
        .limit(1);

      if (acceptances.length === 0) {
        return null;
      }

      const acceptance = acceptances[0];

      // Get the document version to retrieve the URL
      const documentVersion = await this.getVersion(
        LEGAL_DOCUMENT_IDS.PER_RENTAL_AGREEMENT,
        acceptance.version,
      );

      if (!documentVersion) {
        return null;
      }

      return {
        version: documentVersion.version,
        url: documentVersion.url,
      };
    } catch (error) {
      console.error("Error fetching rental agreement acceptance:", error);
      throw error;
    }
  }
}
