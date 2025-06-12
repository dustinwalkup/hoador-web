import {
  pgTable,
  varchar,
  text,
  timestamp,
  decimal,
  uuid,
  index,
} from "drizzle-orm/pg-core";

import { rentals } from "./rentals";
import { users } from "./users";
import { paymentStatusEnum } from "./_enums";

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rentalId: uuid("rental_id")
      .references(() => rentals.id, { onDelete: "cascade" })
      .notNull(),
    payerId: uuid("payer_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    payeeId: uuid("payee_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    platformFee: decimal("platform_fee", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    paymentMethodId: varchar("payment_method_id", { length: 255 }), // Stripe payment method ID
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    status: paymentStatusEnum("status").default("pending").notNull(),
    paidAt: timestamp("paid_at"),
    refundedAt: timestamp("refunded_at"),
    refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }),
    refundReason: text("refund_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    rentalIdIdx: index("payments_rental_id_idx").on(table.rentalId),
    payerIdIdx: index("payments_payer_id_idx").on(table.payerId),
    payeeIdIdx: index("payments_payee_id_idx").on(table.payeeId),
    statusIdx: index("payments_status_idx").on(table.status),
    stripePaymentIntentIdx: index("payments_stripe_payment_intent_idx").on(
      table.stripePaymentIntentId,
    ),
  }),
);
