import {
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { messageStatusEnum } from "./_enums";
import { users } from "./users.schema";
import { rentals } from "./rentals.schema";

// Conversations table (1-to-1 only)
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    user1Id: uuid("user1_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    user2Id: uuid("user2_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    lastMessageAt: timestamp("last_message_at"),
    // Per-user settings
    user1LastReadAt: timestamp("user1_last_read_at"),
    user2LastReadAt: timestamp("user2_last_read_at"),
    user1Archived: boolean("user1_archived").default(false).notNull(),
    user2Archived: boolean("user2_archived").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // Ensure unique conversation per user pair (regardless of order)
    uniqueUserPair: unique("conversations_unique_user_pair").on(
      table.user1Id,
      table.user2Id,
    ),
    user1Idx: index("conversations_user1_idx").on(table.user1Id),
    user2Idx: index("conversations_user2_idx").on(table.user2Id),
    lastMessageAtIdx: index("conversations_last_message_at_idx").on(
      table.lastMessageAt,
    ),
  }),
);

// Messages table
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    senderId: uuid("sender_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    status: messageStatusEnum("status").default("sent").notNull(),
    // Optional: Link to rental for context (but don't require it)
    rentalId: uuid("rental_id").references(() => rentals.id), // nullable
    editedAt: timestamp("edited_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    conversationIdIdx: index("messages_conversation_id_idx").on(
      table.conversationId,
    ),
    senderIdIdx: index("messages_sender_id_idx").on(table.senderId),
    rentalIdIdx: index("messages_rental_id_idx").on(table.rentalId),
    createdAtIdx: index("messages_created_at_idx").on(table.createdAt),
    lastMessageAtIdx: index("messages_last_message_at_idx").on(table.createdAt),
  }),
);

// Relations
export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    user1: one(users, {
      fields: [conversations.user1Id],
      references: [users.id],
      relationName: "conversationsAsUser1",
    }),
    user2: one(users, {
      fields: [conversations.user2Id],
      references: [users.id],
      relationName: "conversationsAsUser2",
    }),
    messages: many(messages),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  rental: one(rentals, {
    fields: [messages.rentalId],
    references: [rentals.id],
  }),
}));
