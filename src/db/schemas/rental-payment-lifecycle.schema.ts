import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { rentals } from "./rentals.schema";
import {
  depositHoldStatusEnum,
  ownerTransferStatusEnum,
  payoutStatusEnum,
} from "./_enums";

export const rentalPaymentLifecycle = pgTable(
  "rental_payment_lifecycle",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rentalId: uuid("rental_id")
      .references(() => rentals.id, { onDelete: "cascade" })
      .notNull(),
    rentalChargeId: varchar("rental_charge_id", { length: 255 }), // Stripe Charge ID for source_transaction
    depositHoldStatus: depositHoldStatusEnum("deposit_hold_status")
      .default("scheduled")
      .notNull(),
    depositHoldPlacedAt: timestamp("deposit_hold_placed_at"),
    depositReleasedAt: timestamp("deposit_released_at"),
    depositCapturedAt: timestamp("deposit_captured_at"),
    ownerTransferStatus: ownerTransferStatusEnum("owner_transfer_status")
      .default("pending")
      .notNull(),
    payoutStatus: payoutStatusEnum("payout_status")
      .default("pending")
      .notNull(),
    stripeTransferId: varchar("stripe_transfer_id", { length: 255 }),
    ownerTransferredAt: timestamp("owner_transferred_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    rentalIdIdx: uniqueIndex("rpl_rental_id_idx").on(table.rentalId),
    payoutStatusIdx: index("rpl_payout_status_idx").on(table.payoutStatus),
    depositHoldStatusIdx: index("rpl_deposit_hold_status_idx").on(
      table.depositHoldStatus,
    ),
  }),
);

export const rentalPaymentLifecycleRelations = relations(
  rentalPaymentLifecycle,
  ({ one }) => ({
    rental: one(rentals, {
      fields: [rentalPaymentLifecycle.rentalId],
      references: [rentals.id],
    }),
  }),
);
