import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { rentalRequests } from "./rentals.schema";

/**
 * Generated rental agreement PDFs, one per rental request (created at approval).
 */
export const rentalAgreementDocuments = pgTable(
  "rental_agreement_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rentalRequestId: uuid("rental_request_id")
      .references(() => rentalRequests.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    pdfUrl: varchar("pdf_url", { length: 500 }).notNull(),
    templateVersion: varchar("template_version", { length: 50 }).notNull(),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("rental_agreement_documents_rental_request_id_idx").on(
      table.rentalRequestId,
    ),
  ],
);

export type RentalAgreementDocumentDB =
  typeof rentalAgreementDocuments.$inferSelect;
export type NewRentalAgreementDocument =
  typeof rentalAgreementDocuments.$inferInsert;
