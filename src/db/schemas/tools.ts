import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  uuid,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const toolConditionEnum = pgEnum("tool_condition", [
  "new",
  "good",
  "fair",
  "poor",
]);
export const toolStatusEnum = pgEnum("tool_status", [
  "available",
  "rented",
  "maintenance",
  "inactive",
]);

// Tool categories
export const _toolCategories = pgTable(
  "tool_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: text("description"),
    icon: varchar("icon", { length: 50 }),
    parentId: uuid("parent_id"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: uniqueIndex("tool_categories_name_idx").on(table.name),
    parentIdIdx: index("tool_categories_parent_id_idx").on(table.parentId),
  }),
);

export const toolCategories = _toolCategories;

// Tools
export const tools = pgTable(
  "tools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    categoryId: uuid("category_id")
      .references(() => _toolCategories.id)
      .notNull(),

    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull(),
    brand: varchar("brand", { length: 100 }),
    model: varchar("model", { length: 100 }),
    condition: varchar("condition", { length: 50 }).notNull(), // excellent, good, fair, poor
    dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }).notNull(),
    weeklyRate: decimal("weekly_rate", { precision: 10, scale: 2 }),
    monthlyRate: decimal("monthly_rate", { precision: 10, scale: 2 }),
    securityDeposit: decimal("security_deposit", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    status: toolStatusEnum("status").default("available").notNull(),
    images: jsonb("images").$type<string[]>().default([]).notNull(),
    specifications: jsonb("specifications")
      .$type<Record<string, string | number | boolean | string[]>>()
      .default({})
      .notNull(),
    instructions: text("instructions"),
    safetyNotes: text("safety_notes"),
    minimumRentalPeriod: integer("minimum_rental_period").default(1).notNull(), // in days
    maximumRentalPeriod: integer("maximum_rental_period").default(30).notNull(), // in days
    requiresPickup: boolean("requires_pickup").default(true).notNull(),
    deliveryAvailable: boolean("delivery_available").default(false).notNull(),
    deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    deliveryRadius: integer("delivery_radius").default(0).notNull(), // in miles
    isActive: boolean("is_active").default(true).notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    favoriteCount: integer("favorite_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    ownerIdIdx: index("tools_owner_id_idx").on(table.ownerId),
    categoryIdIdx: index("tools_category_id_idx").on(table.categoryId),
    statusIdx: index("tools_status_idx").on(table.status),
    dailyRateIdx: index("tools_daily_rate_idx").on(table.dailyRate),
    nameSearchIdx: index("tools_name_search_idx").on(table.name),
  }),
);

// Tool availability
export const toolAvailability = pgTable(
  "tool_availability",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    toolId: uuid("tool_id")
      .references(() => tools.id, { onDelete: "cascade" })
      .notNull(),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    isBlocked: boolean("is_blocked").default(false).notNull(), // true for blocked dates, false for available
    reason: varchar("reason", { length: 255 }), // maintenance, personal use, etc.
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    toolIdIdx: index("tool_availability_tool_id_idx").on(table.toolId),
    dateRangeIdx: index("tool_availability_date_range_idx").on(
      table.startDate,
      table.endDate,
    ),
  }),
);
