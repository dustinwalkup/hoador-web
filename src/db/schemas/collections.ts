import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { tools } from "./tools";
import { users } from "./users";

// User favorites
export const userFavorites = pgTable(
  "user_favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    toolId: uuid("tool_id")
      .references(() => tools.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userToolIdx: uniqueIndex("user_favorites_user_tool_idx").on(
      table.userId,
      table.toolId,
    ),
    userIdIdx: index("user_favorites_user_id_idx").on(table.userId),
    toolIdIdx: index("user_favorites_tool_id_idx").on(table.toolId),
  }),
);

// User collections
export const userCollections = pgTable(
  "user_collections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    isPublic: boolean("is_public").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("user_collections_user_id_idx").on(table.userId),
  }),
);

// Collection items
export const collectionItems = pgTable(
  "collection_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    collectionId: uuid("collection_id")
      .references(() => userCollections.id, { onDelete: "cascade" })
      .notNull(),
    toolId: uuid("tool_id")
      .references(() => tools.id, { onDelete: "cascade" })
      .notNull(),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => ({
    collectionToolIdx: uniqueIndex("collection_items_collection_tool_idx").on(
      table.collectionId,
      table.toolId,
    ),
    collectionIdIdx: index("collection_items_collection_id_idx").on(
      table.collectionId,
    ),
    toolIdIdx: index("collection_items_tool_id_idx").on(table.toolId),
  }),
);
