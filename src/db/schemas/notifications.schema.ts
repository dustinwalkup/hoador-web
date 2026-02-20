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
import { relations } from "drizzle-orm";
import { user } from "./user.schema";
import {
  notificationTypeEnum,
  notificationCategoryEnum,
  pushSubscriptionPlatformEnum,
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

// ---- Push subscriptions (Web Push / FCM endpoints per device) ----
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
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
  },
  (table) => [
    index("push_notification_audit_user_id_idx").on(table.userId),
    index("push_notification_audit_sent_at_idx").on(table.sentAt),
    index("push_notification_audit_event_type_idx").on(table.eventType),
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
