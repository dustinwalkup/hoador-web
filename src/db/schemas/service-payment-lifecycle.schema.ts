import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import {
  serviceOwnerTransferStatusEnum,
  servicePayoutStatusEnum,
} from "./_enums";
import { serviceBookings } from "./services.schema";

/**
 * Tracks provider payout pipeline for HOA service bookings (charge-on-accept, transfer after completion).
 * Mirrors rental_payment_lifecycle without deposit-hold columns.
 */
export const servicePaymentLifecycle = pgTable(
  "service_payment_lifecycle",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .references(() => serviceBookings.id, { onDelete: "cascade" })
      .notNull(),
    /** Stripe Charge ID for Connect transfer source_transaction. */
    chargeId: varchar("charge_id", { length: 255 }),
    /**
     * Provider payout in dollars, locked at charge time (same formula as rental ownerPayout).
     * Used for Connect transfer amount; avoids recalculating if PLATFORM_FEE_PERCENTAGE changes.
     */
    providerPayout: numeric("provider_payout", {
      precision: 10,
      scale: 2,
    }),
    ownerTransferStatus: serviceOwnerTransferStatusEnum("owner_transfer_status")
      .default("pending")
      .notNull(),
    payoutStatus: servicePayoutStatusEnum("payout_status")
      .default("pending")
      .notNull(),
    stripeTransferId: varchar("stripe_transfer_id", { length: 255 }),
    ownerTransferredAt: timestamp("owner_transferred_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bookingIdIdx: uniqueIndex("spl_booking_id_idx").on(table.bookingId),
    payoutStatusIdx: index("spl_payout_status_idx").on(table.payoutStatus),
    ownerTransferStatusIdx: index("spl_owner_transfer_status_idx").on(
      table.ownerTransferStatus,
    ),
  }),
);

export const servicePaymentLifecycleRelations = relations(
  servicePaymentLifecycle,
  ({ one }) => ({
    booking: one(serviceBookings, {
      fields: [servicePaymentLifecycle.bookingId],
      references: [serviceBookings.id],
    }),
  }),
);

export type ServicePaymentLifecycleRecord =
  typeof servicePaymentLifecycle.$inferSelect;
export type NewServicePaymentLifecycleRecord =
  typeof servicePaymentLifecycle.$inferInsert;
