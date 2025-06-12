import { relations } from "drizzle-orm";

import { toolAvailability, toolCategories, tools } from "./tools";
import { users } from "./users";
import { collectionItems, userCollections, userFavorites } from "./collections";
import { messages } from "./messages";
import { notifications } from "./notifications";
import { rentalRequests, rentals, reviews } from "./rentals";
import { payments } from "./payments";

export const collectionItemsRelations = relations(
  collectionItems,
  ({ one }) => ({
    collection: one(userCollections, {
      fields: [collectionItems.collectionId],
      references: [userCollections.id],
    }),
    tool: one(tools, {
      fields: [collectionItems.toolId],
      references: [tools.id],
    }),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "sender",
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: "receiver",
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  rental: one(rentals, {
    fields: [payments.rentalId],
    references: [rentals.id],
  }),
  payer: one(users, {
    fields: [payments.payerId],
    references: [users.id],
    relationName: "payer",
  }),
  payee: one(users, {
    fields: [payments.payeeId],
    references: [users.id],
    relationName: "payee",
  }),
}));

export const rentalRequestsRelations = relations(rentalRequests, ({ one }) => ({
  tool: one(tools, {
    fields: [rentalRequests.toolId],
    references: [tools.id],
  }),
  renter: one(users, {
    fields: [rentalRequests.renterId],
    references: [users.id],
    relationName: "renter",
  }),
  owner: one(users, {
    fields: [rentalRequests.ownerId],
    references: [users.id],
    relationName: "owner",
  }),
  rental: one(rentals),
}));

export const rentalsRelations = relations(rentals, ({ one, many }) => ({
  request: one(rentalRequests, {
    fields: [rentals.requestId],
    references: [rentalRequests.id],
  }),
  tool: one(tools, {
    fields: [rentals.toolId],
    references: [tools.id],
  }),
  renter: one(users, {
    fields: [rentals.renterId],
    references: [users.id],
    relationName: "renter",
  }),
  owner: one(users, {
    fields: [rentals.ownerId],
    references: [users.id],
    relationName: "owner",
  }),
  reviews: many(reviews),
  payments: many(payments),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  rental: one(rentals, {
    fields: [reviews.rentalId],
    references: [rentals.id],
  }),
  reviewer: one(users, {
    fields: [reviews.reviewerId],
    references: [users.id],
    relationName: "reviewer",
  }),
  reviewee: one(users, {
    fields: [reviews.revieweeId],
    references: [users.id],
    relationName: "reviewee",
  }),
  tool: one(tools, {
    fields: [reviews.toolId],
    references: [tools.id],
  }),
}));

export const toolCategoriesRelations = relations(
  toolCategories,
  ({ one, many }) => ({
    parent: one(toolCategories, {
      fields: [toolCategories.parentId],
      references: [toolCategories.id],
      relationName: "parent",
    }),
    children: many(toolCategories, { relationName: "parent" }),
    tools: many(tools),
  }),
);

export const toolsRelations = relations(tools, ({ one, many }) => {
  return {
    owner: one(users, {
      fields: [tools.ownerId],
      references: [users.id],
      relationName: "owner",
    }),
    category: one(toolCategories, {
      fields: [tools.categoryId],
      references: [toolCategories.id],
    }),
    availability: many(toolAvailability),
    rentalRequests: many(rentalRequests),
    rentals: many(rentals),
    reviews: many(reviews),
    favorites: many(userFavorites),
    collectionItems: many(collectionItems),
  };
});

export const toolAvailabilityRelations = relations(
  toolAvailability,
  ({ one }) => ({
    tool: one(tools, {
      fields: [toolAvailability.toolId],
      references: [tools.id],
    }),
  }),
);
