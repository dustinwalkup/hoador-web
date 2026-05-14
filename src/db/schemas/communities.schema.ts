import {
  pgTable,
  varchar,
  timestamp,
  uuid,
  pgEnum,
  index,
  uniqueIndex,
  text,
  boolean,
  decimal,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { user } from "./user.schema";
import { listings } from "./listings.schema";
import { verificationStatusEnum } from "./_enums";

// Community membership role enum
export const communityMembershipRoleEnum = pgEnum("community_membership_role", [
  "admin",
  "member",
]);

// Community networks table — regional grouping of communities
export const communityNetworks = pgTable(
  "community_networks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: uniqueIndex("community_networks_name_idx").on(table.name),
    slugIdx: uniqueIndex("community_networks_slug_idx").on(table.slug),
  }),
);

// Communities table
export const communities = pgTable(
  "communities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    imageUrl: varchar("image_url", { length: 500 }),
    joinCode: varchar("join_code", { length: 100 }).unique(),
    address: varchar("address", { length: 255 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 50 }),
    zip: varchar("zip", { length: 20 }),
    networkId: uuid("network_id").references(() => communityNetworks.id),
    latitude: decimal("latitude", { precision: 10, scale: 8 }),
    longitude: decimal("longitude", { precision: 11, scale: 8 }),
    isActive: boolean("is_active").default(true).notNull(),
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
    networkIdIdx: index("communities_network_id_idx").on(table.networkId),
  }),
);

// Community memberships table
export const communityMemberships = pgTable(
  "community_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    communityId: uuid("community_id")
      .references(() => communities.id, { onDelete: "cascade" })
      .notNull(),
    role: communityMembershipRoleEnum("role").default("member").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    verificationStatus: verificationStatusEnum("verification_status")
      .default("pending")
      .notNull(),
    verifiedAt: timestamp("verified_at"),
    verifiedBy: text("verified_by").references(() => user.id, {
      onDelete: "set null",
    }),
    adminNotes: text("admin_notes"),
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
    userPrimaryIdx: uniqueIndex("community_memberships_user_primary_idx")
      .on(table.userId)
      .where(sql`${table.isPrimary} = true`),
    verificationStatusIdx: index(
      "community_memberships_verification_status_idx",
    ).on(table.verificationStatus),
  }),
);

// Community visibility table — symmetric per-community visibility
export const communityVisibility = pgTable(
  "community_visibility",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    communityId: uuid("community_id")
      .references(() => communities.id, { onDelete: "cascade" })
      .notNull(),
    isVisible: boolean("is_visible").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userCommunityIdx: uniqueIndex("community_visibility_user_community_idx").on(
      table.userId,
      table.communityId,
    ),
    visibleByUserIdx: index("community_visibility_user_visible_idx")
      .on(table.userId)
      .where(sql`${table.isVisible} = true`),
    visibleByCommunityIdx: index("community_visibility_community_visible_idx")
      .on(table.communityId)
      .where(sql`${table.isVisible} = true`),
  }),
);

// Relations
export const communityNetworksRelations = relations(
  communityNetworks,
  ({ many }) => ({
    communities: many(communities),
  }),
);

export const communitiesRelations = relations(communities, ({ many, one }) => ({
  memberships: many(communityMemberships),
  listings: many(listings),
  network: one(communityNetworks, {
    fields: [communities.networkId],
    references: [communityNetworks.id],
  }),
  visibility: many(communityVisibility),
}));

export const communityMembershipsRelations = relations(
  communityMemberships,
  ({ one }) => ({
    user: one(user, {
      fields: [communityMemberships.userId],
      references: [user.id],
    }),
    community: one(communities, {
      fields: [communityMemberships.communityId],
      references: [communities.id],
    }),
  }),
);

export const communityVisibilityRelations = relations(
  communityVisibility,
  ({ one }) => ({
    user: one(user, {
      fields: [communityVisibility.userId],
      references: [user.id],
    }),
    community: one(communities, {
      fields: [communityVisibility.communityId],
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

export type CommunityNetwork = typeof communityNetworks.$inferSelect;
export type NewCommunityNetwork = typeof communityNetworks.$inferInsert;
export type UpdateCommunityNetwork = Partial<NewCommunityNetwork>;

export type CommunityVisibility = typeof communityVisibility.$inferSelect;
export type NewCommunityVisibility = typeof communityVisibility.$inferInsert;
export type UpdateCommunityVisibility = Partial<NewCommunityVisibility>;

// Extended types for DAL
export type CommunityWithStats = Community & {
  memberCount: number;
  listingCount: number;
};

export type CommunityMembershipWithDetails = CommunityMembership & {
  community: Community;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatarUrl?: string | null;
  };
};

export type UserCommunityInfo = {
  membership: CommunityMembership;
  community: Community;
};

// Verification queue row (admin) — joins user + primary user_addresses
// for listPendingVerifications.
export type MembershipWithUserAndAddress = {
  membership: CommunityMembership;
  community: Community;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatarUrl: string | null;
  };
  address: {
    id: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  } | null;
};

// Visibility row joined with the community for the settings UI.
// `isPrimary` flags the user's home community (locked-visible in the UI).
export type CommunityVisibilityWithCommunity = {
  visibility: CommunityVisibility;
  community: Community;
  isPrimary: boolean;
};
