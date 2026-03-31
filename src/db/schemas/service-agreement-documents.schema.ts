import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { serviceBookings } from "./services.schema";

/**
 * Generated service agreement PDFs, one per service booking (created at acceptance).
 */
export const serviceAgreementDocuments = pgTable(
  "service_agreement_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    serviceBookingId: uuid("service_booking_id")
      .references(() => serviceBookings.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    pdfUrl: varchar("pdf_url", { length: 500 }).notNull(),
    templateVersion: varchar("template_version", { length: 50 }).notNull(),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("service_agreement_documents_service_booking_id_idx").on(
      table.serviceBookingId,
    ),
  ],
);

export type ServiceAgreementDocumentDB =
  typeof serviceAgreementDocuments.$inferSelect;
export type NewServiceAgreementDocument =
  typeof serviceAgreementDocuments.$inferInsert;
