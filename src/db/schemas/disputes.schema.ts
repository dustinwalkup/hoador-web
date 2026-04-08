import {
  pgTable,
  uuid,
  timestamp,
  varchar,
  text,
  decimal,
  index,
  jsonb,
  serial,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { user } from "./user.schema";
import { rentals } from "./rentals.schema";
import { serviceBookings } from "./services.schema";
import {
  disputeStatusEnum,
  disputeReasonCodeEnum,
  disputeRoleEnum,
  disputeResolutionOutcomeEnum,
  evidenceTypeEnum,
  auditActionTypeEnum,
  financialOperationTypeEnum,
  financialOperationStatusEnum,
} from "./_enums";

// Disputes table
export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    referenceNumber: serial("reference_number"),
    rentalId: uuid("rental_id").references(() => rentals.id, {
      onDelete: "restrict",
    }),
    serviceBookingId: uuid("service_booking_id").references(
      () => serviceBookings.id,
      { onDelete: "restrict" },
    ),
    createdBy: text("created_by")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    createdByRole: disputeRoleEnum("created_by_role").notNull(),
    reasonCode: disputeReasonCodeEnum("reason_code").notNull(),
    description: text("description").notNull(),
    status: disputeStatusEnum("status").default("open").notNull(),
    policyVersion: varchar("policy_version", { length: 50 }).notNull(),
    evidenceDeadline: timestamp("evidence_deadline"),
    additionalEvidenceDeadline: timestamp("additional_evidence_deadline"),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: text("resolved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    resolutionOutcome: disputeResolutionOutcomeEnum("resolution_outcome"),
    resolutionReason: text("resolution_reason"), // Max 1000 chars enforced in application layer
    stripeChargebackId: varchar("stripe_chargeback_id", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("disputes_reference_number_idx").on(table.referenceNumber),
    uniqueIndex("disputes_rental_id_unique").on(table.rentalId),
    uniqueIndex("disputes_service_booking_id_unique").on(
      table.serviceBookingId,
    ),
    check(
      "disputes_rental_xor_service_booking_ck",
      sql`(${table.rentalId} IS NOT NULL AND ${table.serviceBookingId} IS NULL) OR (${table.rentalId} IS NULL AND ${table.serviceBookingId} IS NOT NULL)`,
    ),
    index("disputes_rental_id_idx").on(table.rentalId),
    index("disputes_service_booking_id_idx").on(table.serviceBookingId),
    index("disputes_created_by_idx").on(table.createdBy),
    index("disputes_status_idx").on(table.status),
    index("disputes_reason_code_idx").on(table.reasonCode),
    index("disputes_created_at_idx").on(table.createdAt),
    index("disputes_rental_id_status_idx").on(table.rentalId, table.status),
    index("disputes_service_booking_id_status_idx").on(
      table.serviceBookingId,
      table.status,
    ),
  ],
);

// Dispute evidence table
export const disputeEvidence = pgTable(
  "dispute_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    disputeId: uuid("dispute_id")
      .references(() => disputes.id, { onDelete: "cascade" })
      .notNull(),
    uploadedBy: text("uploaded_by")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    uploadedByRole: disputeRoleEnum("uploaded_by_role").notNull(),
    evidenceType: evidenceTypeEnum("evidence_type").notNull(),
    content: text("content").notNull(), // Stores image URL or text content
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  },
  (table) => [
    index("dispute_evidence_dispute_id_idx").on(table.disputeId),
    index("dispute_evidence_uploaded_by_idx").on(table.uploadedBy),
    index("dispute_evidence_uploaded_at_idx").on(table.uploadedAt),
  ],
);

// Dispute audit logs table
export const disputeAuditLogs = pgTable(
  "dispute_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    disputeId: uuid("dispute_id")
      .references(() => disputes.id, { onDelete: "cascade" })
      .notNull(),
    actionType: auditActionTypeEnum("action_type").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    previousState: disputeStatusEnum("previous_state"),
    newState: disputeStatusEnum("new_state"),
    details: jsonb("details"), // Additional context for the action
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("dispute_audit_logs_dispute_id_idx").on(table.disputeId),
    index("dispute_audit_logs_user_id_idx").on(table.userId),
    index("dispute_audit_logs_action_type_idx").on(table.actionType),
    index("dispute_audit_logs_created_at_idx").on(table.createdAt),
  ],
);

// Dispute internal notes table
export const disputeInternalNotes = pgTable(
  "dispute_internal_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    disputeId: uuid("dispute_id")
      .references(() => disputes.id, { onDelete: "cascade" })
      .notNull(),
    adminId: text("admin_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("dispute_internal_notes_dispute_id_idx").on(table.disputeId),
    index("dispute_internal_notes_admin_id_idx").on(table.adminId),
    index("dispute_internal_notes_created_at_idx").on(table.createdAt),
  ],
);

// Dispute financial operations table
export const disputeFinancialOperations = pgTable(
  "dispute_financial_operations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    disputeId: uuid("dispute_id")
      .references(() => disputes.id, { onDelete: "cascade" })
      .notNull(),
    operationType: financialOperationTypeEnum("operation_type").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }),
    stripeOperationId: varchar("stripe_operation_id", { length: 255 }),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", {
      length: 255,
    }),
    stripeTransferId: varchar("stripe_transfer_id", { length: 255 }),
    status: financialOperationStatusEnum("status").default("pending").notNull(),
    errorMessage: text("error_message"),
    performedBy: text("performed_by")
      .references(() => user.id, { onDelete: "set null" })
      .notNull(),
    performedAt: timestamp("performed_at").defaultNow().notNull(),
  },
  (table) => [
    index("dispute_financial_operations_dispute_id_idx").on(table.disputeId),
    index("dispute_financial_operations_stripe_operation_id_idx").on(
      table.stripeOperationId,
    ),
    index("dispute_financial_operations_status_idx").on(table.status),
  ],
);

// Relations
export const disputesRelations = relations(disputes, ({ one, many }) => ({
  rental: one(rentals, {
    fields: [disputes.rentalId],
    references: [rentals.id],
  }),
  serviceBooking: one(serviceBookings, {
    fields: [disputes.serviceBookingId],
    references: [serviceBookings.id],
  }),
  createdByUser: one(user, {
    fields: [disputes.createdBy],
    references: [user.id],
    relationName: "disputesCreated",
  }),
  resolvedByUser: one(user, {
    fields: [disputes.resolvedBy],
    references: [user.id],
    relationName: "disputesResolved",
  }),
  evidence: many(disputeEvidence),
  auditLogs: many(disputeAuditLogs),
  internalNotes: many(disputeInternalNotes),
  financialOperations: many(disputeFinancialOperations),
}));

export const disputeEvidenceRelations = relations(
  disputeEvidence,
  ({ one }) => ({
    dispute: one(disputes, {
      fields: [disputeEvidence.disputeId],
      references: [disputes.id],
    }),
    uploadedByUser: one(user, {
      fields: [disputeEvidence.uploadedBy],
      references: [user.id],
      relationName: "evidenceUploaded",
    }),
  }),
);

export const disputeAuditLogsRelations = relations(
  disputeAuditLogs,
  ({ one }) => ({
    dispute: one(disputes, {
      fields: [disputeAuditLogs.disputeId],
      references: [disputes.id],
    }),
    user: one(user, {
      fields: [disputeAuditLogs.userId],
      references: [user.id],
      relationName: "auditLogsCreated",
    }),
  }),
);

export const disputeInternalNotesRelations = relations(
  disputeInternalNotes,
  ({ one }) => ({
    dispute: one(disputes, {
      fields: [disputeInternalNotes.disputeId],
      references: [disputes.id],
    }),
    admin: one(user, {
      fields: [disputeInternalNotes.adminId],
      references: [user.id],
      relationName: "internalNotesCreated",
    }),
  }),
);

export const disputeFinancialOperationsRelations = relations(
  disputeFinancialOperations,
  ({ one }) => ({
    dispute: one(disputes, {
      fields: [disputeFinancialOperations.disputeId],
      references: [disputes.id],
    }),
    performedByUser: one(user, {
      fields: [disputeFinancialOperations.performedBy],
      references: [user.id],
      relationName: "financialOperationsPerformed",
    }),
  }),
);
