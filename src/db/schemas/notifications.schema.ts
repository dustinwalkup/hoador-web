import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { user } from "./user.schema";
import {
  notificationTypeEnum,
  notificationCategoryEnum,
  pushSubscriptionPlatformEnum,
  pushReceiptStatusEnum,
} from "./_enums";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    data: jsonb("data")
      .$type<Record<string, string | number | boolean | string[] | null>>()
      .default({})
      .notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
    index("notifications_type_idx").on(table.type),
    index("notifications_is_read_idx").on(table.isRead),
  ],
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(user, {
    fields: [notifications.userId],
    references: [user.id],
  }),
}));

// ---- Notification category preferences (per-category email/push toggles) ----
export const notificationCategoryPreferences = pgTable(
  "notification_category_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    category: notificationCategoryEnum("category").notNull(),
    email: boolean("email").default(true).notNull(),
    push: boolean("push").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("notification_category_preferences_user_id_idx").on(table.userId),
    uniqueIndex("notification_category_preferences_user_category_unique").on(
      table.userId,
      table.category,
    ),
  ],
);

export const notificationCategoryPreferencesRelations = relations(
  notificationCategoryPreferences,
  ({ one }) => ({
    user: one(user, {
      fields: [notificationCategoryPreferences.userId],
      references: [user.id],
    }),
  }),
);

// ---- Push subscriptions (Web Push / Expo push tokens per device) ----
/**
 * One row per subscribed device. Two mutually exclusive shapes, discriminated
 * by `platform`:
 *
 * - `web`  — browser Web Push. `endpoint` + `p256dh` + `auth` are all present;
 *            `token` is null.
 * - `ios` / `android` — Expo push. `token` holds the ExponentPushToken;
 *            `endpoint` mirrors it (kept non-null for the shared unique/index
 *            surface) and `p256dh`/`auth` are null.
 *
 * `p256dh`/`auth` were `NOT NULL` until the native-push work — an Expo token has
 * no VAPID keypair, so the column-level constraint could not survive a second
 * platform. The invariant now lives in `assertSubscriptionShape` (notifications
 * DAL) and is covered by tests, because the database no longer enforces it.
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md (F1, D-E2-1).
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh"),
    auth: text("auth"),
    platform: pushSubscriptionPlatformEnum("platform").default("web").notNull(),
    token: text("token"),
    userAgent: text("user_agent"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("push_subscriptions_user_id_idx").on(table.userId),
    index("push_subscriptions_endpoint_idx").on(table.endpoint),
    index("push_subscriptions_user_id_active_idx").on(
      table.userId,
      table.isActive,
    ),
    // Dedup was previously a read-then-write in the DAL with no constraint
    // behind it, so two concurrent subscribes for one device could both insert.
    // These partial uniques make that race a constraint violation rather than a
    // duplicate row (which would fan out N identical pushes to one device).
    //
    // Scoped to `is_active` deliberately: the DAL collapses duplicates by
    // *deactivating* them, never deleting, so inactive rows sharing an endpoint
    // are ordinary history and must stay legal — a unique index over all rows
    // would fail to build against existing data. "At most one *active* row per
    // device" is the invariant the send path actually depends on, since
    // `getActiveByUserId` only ever reads active rows.
    // Spec: epic-02-backend-services.md (F3, F37, D-E2-1).
    uniqueIndex("push_subscriptions_endpoint_web_active_uniq")
      .on(table.endpoint)
      .where(sql`${table.platform} = 'web' and ${table.isActive}`),
    uniqueIndex("push_subscriptions_token_native_active_uniq")
      .on(table.token)
      .where(
        sql`${table.platform} in ('ios', 'android') and ${table.isActive}`,
      ),
  ],
);

// ---- Push notification audit (delivery success/failure per send) ----
export const pushNotificationAudit = pgTable(
  "push_notification_audit",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    subscriptionId: uuid("subscription_id").references(
      () => pushSubscriptions.id,
      { onDelete: "set null" },
    ),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    success: boolean("success").notNull(),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
    /**
     * Expo push ticket id, for the receipt-check cron to resolve later.
     * Null for web sends and for native sends whose ticket errored immediately.
     */
    expoTicketId: text("expo_ticket_id"),
    /** Null = web send (no receipt concept). See `pushReceiptStatusEnum`. */
    receiptStatus: pushReceiptStatusEnum("receipt_status"),
  },
  (table) => [
    index("push_notification_audit_user_id_idx").on(table.userId),
    index("push_notification_audit_sent_at_idx").on(table.sentAt),
    index("push_notification_audit_event_type_idx").on(table.eventType),
    // The receipt cron's only query: unresolved tickets, oldest first. Partial
    // so it stays small — the overwhelming majority of rows are resolved or web.
    index("push_notification_audit_pending_receipt_idx")
      .on(table.sentAt)
      .where(sql`${table.receiptStatus} = 'pending'`),
  ],
);

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one, many }) => ({
    user: one(user, {
      fields: [pushSubscriptions.userId],
      references: [user.id],
    }),
    auditLogs: many(pushNotificationAudit),
  }),
);

export const pushNotificationAuditRelations = relations(
  pushNotificationAudit,
  ({ one }) => ({
    user: one(user, {
      fields: [pushNotificationAudit.userId],
      references: [user.id],
    }),
    subscription: one(pushSubscriptions, {
      fields: [pushNotificationAudit.subscriptionId],
      references: [pushSubscriptions.id],
    }),
  }),
);
