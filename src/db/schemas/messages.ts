import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uuid,
  index,
} from "drizzle-orm/pg-core";

import { messageStatusEnum } from "./_enums";
import { users } from "./users";

// Messages
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").notNull(),
    senderId: uuid("sender_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    receiverId: uuid("receiver_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    attachments: jsonb("attachments").$type<string[]>().default([]).notNull(),
    status: messageStatusEnum("status").default("sent").notNull(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    conversationIdIdx: index("messages_conversation_id_idx").on(
      table.conversationId,
    ),
    senderIdIdx: index("messages_sender_id_idx").on(table.senderId),
    receiverIdIdx: index("messages_receiver_id_idx").on(table.receiverId),
    statusIdx: index("messages_status_idx").on(table.status),
  }),
);
