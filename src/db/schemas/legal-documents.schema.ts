import {
  pgTable,
  varchar,
  text,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { user } from "./user.schema";
import { rentalRequests } from "./rentals.schema";
import { listings } from "./listings.schema";

export type LegalDocumentDB = typeof legalDocuments.$inferSelect;
export type NewLegalDocument = typeof legalDocuments.$inferInsert;
export type UserLegalAcceptanceDB = typeof userLegalAcceptances.$inferSelect;
export type NewUserLegalAcceptance = typeof userLegalAcceptances.$inferInsert;

// Legal documents table - tracks document versions
export const legalDocuments = pgTable("legal_documents", {
  id: text("id").primaryKey(), // Document slug (e.g., 'tos', 'privacy', 'community')
  version: varchar("version", { length: 50 }).notNull(), // Version identifier (e.g., '1.0', '2.0')
  publishedAt: timestamp("published_at").notNull(), // When this version was published
  url: varchar("url", { length: 500 }).notNull(), // Blob storage URL for the document PDF
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// User legal acceptances table - audit trail for all acceptances
export const userLegalAcceptances = pgTable(
  "user_legal_acceptances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    documentId: text("document_id").notNull(), // References legal_documents.id
    version: varchar("version", { length: 50 }).notNull(), // Version accepted
    rentalRequestId: uuid("rental_request_id").references(
      () => rentalRequests.id,
      { onDelete: "cascade" },
    ), // Optional: links to specific rental request
    listingId: uuid("listing_id").references(() => listings.id, {
      onDelete: "cascade",
    }), // Optional: links to specific listing
    acceptedAt: timestamp("accepted_at").defaultNow().notNull(), // When accepted
    ipAddress: varchar("ip_address", { length: 45 }), // IP address at acceptance
    userAgent: text("user_agent"), // User agent at acceptance
    method: varchar("method", { length: 50 }).notNull(), // Signup method (e.g., 'email', 'oauth_google')
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("user_legal_acceptances_user_id_idx").on(table.userId),
    documentIdIdx: index("user_legal_acceptances_document_id_idx").on(
      table.documentId,
    ),
    userIdDocumentIdIdx: index("user_legal_acceptances_user_document_idx").on(
      table.userId,
      table.documentId,
    ),
    rentalRequestIdIdx: index(
      "user_legal_acceptances_rental_request_id_idx",
    ).on(table.rentalRequestId),
    listingIdIdx: index("user_legal_acceptances_listing_id_idx").on(
      table.listingId,
    ),
  }),
);

// Relations
export const legalDocumentsRelations = relations(
  legalDocuments,
  ({ many }) => ({
    acceptances: many(userLegalAcceptances),
  }),
);

export const userLegalAcceptancesRelations = relations(
  userLegalAcceptances,
  ({ one }) => ({
    user: one(user, {
      fields: [userLegalAcceptances.userId],
      references: [user.id],
    }),
    rentalRequest: one(rentalRequests, {
      fields: [userLegalAcceptances.rentalRequestId],
      references: [rentalRequests.id],
    }),
    listing: one(listings, {
      fields: [userLegalAcceptances.listingId],
      references: [listings.id],
    }),
  }),
);
