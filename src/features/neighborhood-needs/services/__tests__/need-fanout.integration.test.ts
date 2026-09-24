import { describe, it, expect, vi, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";

/**
 * PERF-02 + SEC-15 against a REAL Postgres. Posting a Neighborhood Need used
 * to cost ~4 queries per network member, all released into the pool at once.
 * These tests pin the set-based replacement: the raw INSERT … SELECT, the
 * opt-in push-target join, the posting throttle's counts, and a total query
 * count that doesn't grow with the network. Expo is mocked; every database
 * statement is real.
 */

// Held, not run, so a test controls when the fan-out happens and can measure
// exactly its queries.
let pendingAfter: (() => Promise<void>) | undefined;
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => Promise<void>) => {
    pendingAfter = fn;
  },
}));
const runAfter = async () => {
  await pendingAfter?.();
};

const mockSendPushNotificationsAsync = vi.fn();
vi.mock("expo-server-sdk", () => ({
  Expo: class {
    chunkPushNotifications(messages: unknown[]) {
      const out = [];
      for (let i = 0; i < messages.length; i += 100)
        out.push(messages.slice(i, i + 100));
      return out;
    }
    sendPushNotificationsAsync(chunk: { to: string }[]) {
      return mockSendPushNotificationsAsync(chunk);
    }
  },
}));

import { db } from "@/db/db-e2e";
import { schema } from "@/db/schemas";
import { notificationsDAL, pushSubscriptionDAL } from "@/dal";
import { NeedLimitReachedError } from "@/dal/errors";
import { neighborhoodNeedsDAL } from "@/dal";
import { createNeed } from "../neighborhood-needs-service";
import { createCommunity, createUser } from "@/test/integration/factories";

const {
  user,
  communityMemberships,
  communityVisibility,
  listingCategories,
  neighborhoodNeeds,
  notifications,
  notificationCategoryPreferences,
  pushSubscriptions,
  pushNotificationAudit,
  userPreferences,
} = schema;

type Community = Awaited<ReturnType<typeof createCommunity>>;

/** A member visible (or not) in the community. */
async function member(
  community: Community,
  opts: { visible?: boolean; id?: string } = {},
) {
  const row = await createUser(opts.id ? { id: opts.id } : {});
  await db.insert(communityVisibility).values({
    userId: row.id,
    communityId: community.id,
    isVisible: opts.visible ?? true,
  });
  return row;
}

async function optIn(userId: string, push = true) {
  await db.insert(notificationCategoryPreferences).values({
    userId,
    category: "neighborhood_needs",
    email: false,
    push,
  });
}

async function nativeSub(userId: string, isActive = true) {
  const token = `ExponentPushToken[${userId}]`;
  const [row] = await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint: token, platform: "ios", token, isActive })
    .returning();
  return row;
}

async function webSub(userId: string) {
  const [row] = await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: `https://fcm.googleapis.com/fcm/send/${userId}`,
      p256dh: "key",
      auth: "auth",
      platform: "web",
    })
    .returning();
  return row;
}

/** A creator who can post: primary membership, visible, and a category. */
async function poster(community: Community) {
  const creator = await member(community);
  await db.insert(communityMemberships).values({
    userId: creator.id,
    communityId: community.id,
    isPrimary: true,
  });
  const [category] = await db
    .insert(listingCategories)
    .values({ name: `Tools ${creator.id}` })
    .returning();
  return { creator, categoryId: category.id };
}

beforeEach(() => {
  vi.clearAllMocks();
  pendingAfter = undefined;
  mockSendPushNotificationsAsync.mockImplementation(
    async (chunk: { to: string }[]) =>
      chunk.map((m) => ({ status: "ok", id: `ticket-${m.to}` })),
  );
});

describe("notificationsDAL.bulkCreateForVisibleCommunity", () => {
  it("writes one row per visible member, skipping the creator, hidden members and other communities", async () => {
    const community = await createCommunity();
    const other = await createCommunity();
    const creator = await member(community);
    const a = await member(community);
    const b = await member(community);
    await member(community, { visible: false });
    await member(other);

    const written = await notificationsDAL.bulkCreateForVisibleCommunity({
      communityId: community.id,
      excludeUserId: creator.id,
      type: "neighborhood_need_created",
      title: "New Neighborhood Need",
      message: 'A neighbor posted a new rental request: "Drill"',
      data: { needId: "need-1", needType: "rental", linkUrl: "https://x/n" },
    });

    expect(written).toBe(2);
    const rows = await db.select().from(notifications);
    expect(rows.map((r) => r.userId).sort()).toEqual([a.id, b.id].sort());
    // The same row `notificationsDAL.create` writes.
    expect(rows[0]).toMatchObject({
      type: "neighborhood_need_created",
      title: "New Neighborhood Need",
      message: 'A neighbor posted a new rental request: "Drill"',
      data: { needId: "need-1", needType: "rental", linkUrl: "https://x/n" },
      isRead: false,
      readAt: null,
    });
  });
});

describe("pushSubscriptionDAL.getOptInPushTargetsInCommunity", () => {
  it("returns only visible, opted-in members with active subscriptions and push on", async () => {
    const community = await createCommunity();
    const creator = await member(community);
    await optIn(creator.id);
    await nativeSub(creator.id);

    // Included: explicit opt-in, no user_preferences row (master defaults on).
    const optedIn = await member(community);
    await optIn(optedIn.id);
    const optedInSub = await nativeSub(optedIn.id);
    await nativeSub(optedIn.id, false); // inactive device: not returned

    // Included: web subscribers still get their push.
    const webUser = await member(community);
    await optIn(webUser.id);
    const webUserSub = await webSub(webUser.id);

    // Excluded: no category row (the opt-in default is OFF).
    const noRow = await member(community);
    await nativeSub(noRow.id);

    // Excluded: category row with push off.
    const pushOff = await member(community);
    await optIn(pushOff.id, false);
    await nativeSub(pushOff.id);

    // Excluded: opted in, but the master push toggle is off.
    const masterOff = await member(community);
    await optIn(masterOff.id);
    await nativeSub(masterOff.id);
    await db
      .insert(userPreferences)
      .values({ userId: masterOff.id, pushNotifications: false });

    // Excluded: opted in but not visible in this community.
    const hidden = await member(community, { visible: false });
    await optIn(hidden.id);
    await nativeSub(hidden.id);

    const targets = await pushSubscriptionDAL.getOptInPushTargetsInCommunity({
      communityId: community.id,
      excludeUserId: creator.id,
      category: "neighborhood_needs",
    });

    expect(targets.map((t) => t.id).sort()).toEqual(
      [optedInSub.id, webUserSub.id].sort(),
    );
  });
});

describe("createNeed fan-out", () => {
  it("costs a fixed handful of queries for a 500-member network", async () => {
    const community = await createCommunity();
    const { creator, categoryId } = await poster(community);

    const ids = Array.from({ length: 500 }, (_, i) => `member-${i}`);
    await db.insert(user).values(
      ids.map((id) => ({
        id,
        name: "Member",
        email: `${id}@integration.test`,
        emailVerified: true,
        status: "active" as const,
      })),
    );
    await db
      .insert(communityVisibility)
      .values(ids.map((userId) => ({ userId, communityId: community.id })));
    // A handful opted in to push; the rest get the in-app row only.
    for (const id of ids.slice(0, 3)) {
      await optIn(id);
      await nativeSub(id);
    }

    await createNeed(creator.id, {
      type: "rental",
      categoryId,
      title: "Need a drill",
      description: "For a weekend",
    });

    // Count only the fan-out's round-trips, which run in after().
    const client = (db as unknown as { $client: Pool }).$client;
    const query = vi.spyOn(client, "query");
    await runAfter();
    const fanOutQueries = query.mock.calls.length;
    query.mockRestore();

    // visibility check + INSERT … SELECT + push-target join + bulk audit.
    // Was ~4 per member: ~2,000 here. (> 0 proves the spy sees the queries.)
    expect(fanOutQueries).toBeGreaterThan(0);
    expect(fanOutQueries).toBeLessThanOrEqual(5);

    const inApp = await db
      .select({ userId: notifications.userId })
      .from(notifications);
    expect(inApp).toHaveLength(500);
    expect(inApp.some((r) => r.userId === creator.id)).toBe(false);

    // Push only to the three opted-in members, in one Expo send.
    expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(
      mockSendPushNotificationsAsync.mock.calls[0][0].map(
        (m: { to: string }) => m.to,
      ),
    ).toEqual(
      expect.arrayContaining(
        ids.slice(0, 3).map((id) => `ExponentPushToken[${id}]`),
      ),
    );
    const audits = await db.select().from(pushNotificationAudit);
    expect(audits).toHaveLength(3);
    expect(audits.every((a) => a.receiptStatus === "pending")).toBe(true);
  });

  it("deactivates a token Expo reports as DeviceNotRegistered", async () => {
    const community = await createCommunity();
    const { creator, categoryId } = await poster(community);
    const gone = await member(community);
    await optIn(gone.id);
    const sub = await nativeSub(gone.id);
    mockSendPushNotificationsAsync.mockResolvedValue([
      {
        status: "error",
        message: "not registered",
        details: { error: "DeviceNotRegistered" },
      },
    ]);

    await createNeed(creator.id, {
      type: "rental",
      categoryId,
      title: "Need a ladder",
      description: "Gutters",
    });
    await runAfter();

    const [row] = await db
      .select({ isActive: pushSubscriptions.isActive })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.id, sub.id));
    expect(row.isActive).toBe(false);
  });
});

describe("posting limits (SEC-15)", () => {
  async function seedNeeds(
    creatorId: string,
    communityId: string,
    categoryId: string,
    rows: Array<Partial<typeof neighborhoodNeeds.$inferInsert>>,
  ) {
    await db.insert(neighborhoodNeeds).values(
      rows.map((r) => ({
        createdByUserId: creatorId,
        communityId,
        type: "rental" as const,
        categoryId,
        title: "Old need",
        description: "Seeded",
        ...r,
      })),
    );
  }

  it("counts open needs and the last day's posts, deleted and closed included", async () => {
    const community = await createCommunity();
    const { creator, categoryId } = await poster(community);
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await seedNeeds(creator.id, community.id, categoryId, [
      {}, // open, today
      { status: "closed", closeReason: "manual" }, // closed, today
      { deletedAt: new Date() }, // deleted, today
      { createdAt: twoDaysAgo }, // open, old
      { status: "closed", closeReason: "manual", createdAt: twoDaysAgo },
    ]);

    const counts = await neighborhoodNeedsDAL.getPostingCounts(
      creator.id,
      new Date(Date.now() - 24 * 60 * 60 * 1000),
    );

    expect(counts).toEqual({ open: 2, recent: 3 });
  });

  it("refuses a sixth open need and inserts nothing", async () => {
    const community = await createCommunity();
    const { creator, categoryId } = await poster(community);
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await seedNeeds(
      creator.id,
      community.id,
      categoryId,
      Array.from({ length: 5 }, () => ({ createdAt: old })),
    );

    await expect(
      createNeed(creator.id, {
        type: "rental",
        categoryId,
        title: "One more",
        description: "Too many",
      }),
    ).rejects.toBeInstanceOf(NeedLimitReachedError);

    const rows = await db
      .select({ id: neighborhoodNeeds.id })
      .from(neighborhoodNeeds)
      .where(
        and(
          eq(neighborhoodNeeds.createdByUserId, creator.id),
          eq(neighborhoodNeeds.title, "One more"),
        ),
      );
    expect(rows).toHaveLength(0);
    expect(pendingAfter).toBeUndefined();
  });
});
