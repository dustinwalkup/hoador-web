import {
  pgTable,
  varchar,
  timestamp,
  uuid,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users.schema";
import { listings } from "./listings.schema";

// Community membership role enum
export const communityMembershipRoleEnum = pgEnum("community_membership_role", [
  "admin",
  "member",
]);

// Communities table
export const communities = pgTable(
  "communities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    imageUrl: varchar("image_url", { length: 500 }),
    joinCode: varchar("join_code", { length: 100 }).notNull().unique(),
    address: varchar("address", { length: 255 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 50 }),
    zip: varchar("zip", { length: 20 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    joinCodeIdx: uniqueIndex("communities_join_code_idx").on(table.joinCode),
    nameIdx: index("communities_name_idx").on(table.name),
    cityStateIdx: index("communities_city_state_idx").on(
      table.city,
      table.state,
    ),
  }),
);

// Community memberships table
export const communityMemberships = pgTable(
  "community_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    communityId: uuid("community_id")
      .references(() => communities.id, { onDelete: "cascade" })
      .notNull(),
    role: communityMembershipRoleEnum("role").default("member").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("community_memberships_user_id_idx").on(table.userId),
    communityIdIdx: index("community_memberships_community_id_idx").on(
      table.communityId,
    ),
    userCommunityIdx: uniqueIndex(
      "community_memberships_user_community_idx",
    ).on(table.userId, table.communityId),
  }),
);

// Relations
export const communitiesRelations = relations(communities, ({ many }) => ({
  memberships: many(communityMemberships),
  listings: many(listings),
}));

export const communityMembershipsRelations = relations(
  communityMemberships,
  ({ one }) => ({
    user: one(users, {
      fields: [communityMemberships.userId],
      references: [users.id],
    }),
    community: one(communities, {
      fields: [communityMemberships.communityId],
      references: [communities.id],
    }),
  }),
);

// Types
export type Community = typeof communities.$inferSelect;
export type NewCommunity = typeof communities.$inferInsert;
export type UpdateCommunity = Partial<NewCommunity>;

export type CommunityMembership = typeof communityMemberships.$inferSelect;
export type NewCommunityMembership = typeof communityMemberships.$inferInsert;
export type UpdateCommunityMembership = Partial<NewCommunityMembership>;

// Extended types for DAL
export type CommunityWithStats = Community & {
  memberCount: number;
  listingCount: number;
};

export type CommunityMembershipWithDetails = CommunityMembership & {
  community: Community;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string | null;
  };
};

export type UserCommunityInfo = {
  membership: CommunityMembership;
  community: Community;
};
