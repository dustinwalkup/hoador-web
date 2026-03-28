import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { reviewEntityKindEnum, reviewEventTypeEnum } from "./_enums";
import { user } from "./user.schema";

export const reviewEvents = pgTable(
  "review_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityKind: reviewEntityKindEnum("entity_kind").notNull(),
    entityId: varchar("entity_id", { length: 255 }).notNull(),
    eventType: reviewEventTypeEnum("event_type").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("review_events_entity_kind_entity_id_idx").on(
      table.entityKind,
      table.entityId,
    ),
    index("review_events_entity_kind_event_type_created_at_idx").on(
      table.entityKind,
      table.eventType,
      table.createdAt,
    ),
    index("review_events_actor_user_id_created_at_idx").on(
      table.actorUserId,
      table.createdAt,
    ),
    index("review_events_created_at_idx").on(table.createdAt),
  ],
);

export type ReviewEventRow = typeof reviewEvents.$inferSelect;
export type NewReviewEvent = typeof reviewEvents.$inferInsert;
