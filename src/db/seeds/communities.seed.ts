import { db } from "../db-seed"; // Use WebSocket driver for Node.js compatibility
import {
  communities,
  communityMemberships,
  communityNetworks,
  communityVisibility,
} from "../schemas/communities.schema";
import { user } from "../schemas/user.schema";

const KC_METRO_SLUG = "kansas-city-metro";
const TEST_NETWORK_SLUG = "test-network";

const KC_METRO_COMMUNITIES = [
  { name: "Glen Arbor Estates", city: "Kansas City", state: "MO" },
  { name: "Foxcroft", city: "Kansas City", state: "MO" },
  { name: "Timber Trace", city: "Kansas City", state: "MO" },
  { name: "Blue Hills Estates", city: "Kansas City", state: "MO" },
  { name: "Redbridge North", city: "Kansas City", state: "MO" },
  { name: "Verona Gardens", city: "Leawood", state: "KS" },
  { name: "Redbridge Estates", city: "Kansas City", state: "MO" },
  { name: "Leawood Estates", city: "Leawood", state: "KS" },
] as const;

const TEST_NETWORK_COMMUNITIES = [
  {
    name: "Sunset Hills HOA",
    joinCode: "SUNSET-HILLS-2024",
    address: "123 Sunset Drive",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
    imageUrl: "https://example.com/sunset-hills.jpg",
  },
  {
    name: "Downtown Apartments",
    joinCode: "DOWNTOWN-APT-2024",
    address: "456 Market Street",
    city: "San Francisco",
    state: "CA",
    zip: "94105",
  },
  {
    name: "Green Valley Neighborhood",
    joinCode: "GREEN-VALLEY-2024",
    address: "789 Green Valley Road",
    city: "Palo Alto",
    state: "CA",
    zip: "94301",
  },
] as const;

export async function main() {
  console.log("🏘️ Seeding communities...");

  // 1. Networks
  console.log("🌐 Creating community networks...");
  const [kcMetro, testNetwork] = await db
    .insert(communityNetworks)
    .values([
      {
        name: "Kansas City Metro",
        slug: KC_METRO_SLUG,
        description:
          "Connected neighborhood marketplace network across the Kansas City metro area.",
      },
      {
        name: "Test Network",
        slug: TEST_NETWORK_SLUG,
        description: "Development/test network for the original seeded HOAs.",
      },
    ])
    .returning();
  if (!kcMetro || !testNetwork) {
    throw new Error("Failed to insert community networks");
  }
  console.log(`✅ Created 2 networks (KC Metro, Test Network)`);

  // 2. Communities — Test Network (existing 3 dev communities, kept as-is)
  console.log("📍 Creating Test Network communities...");
  const testCommunities = await db
    .insert(communities)
    .values(
      TEST_NETWORK_COMMUNITIES.map((c) => ({
        ...c,
        networkId: testNetwork.id,
      })),
    )
    .returning();

  // 3. Communities — KC Metro (8 new communities)
  console.log("📍 Creating Kansas City Metro communities...");
  const kcCommunities = await db
    .insert(communities)
    .values(
      KC_METRO_COMMUNITIES.map((c) => ({
        name: c.name,
        city: c.city,
        state: c.state,
        networkId: kcMetro.id,
      })),
    )
    .returning();

  const allCommunities = [...testCommunities, ...kcCommunities];
  console.log(
    `✅ Created ${allCommunities.length} communities (${testCommunities.length} Test Network, ${kcCommunities.length} KC Metro)`,
  );

  // 4. Users → primary memberships
  const allUsers = await db.select().from(user);
  console.log(`👥 Found ${allUsers.length} users to assign to communities`);

  if (allUsers.length === 0) {
    console.log("⚠️ No users found - make sure users.seed.ts runs before this");
    return;
  }

  // Distribute users round-robin across all communities. The first user in
  // each community is its admin. Memberships are seeded as primary + verified
  // (matches the post-backfill state per design §5.3).
  const memberships = allUsers.map((u, i) => {
    const community = allCommunities[i % allCommunities.length];
    const role: "admin" | "member" =
      i < allCommunities.length ? "admin" : "member";
    return {
      userId: u.id,
      communityId: community.id,
      role,
      isPrimary: true,
      verificationStatus: "verified" as const,
      verifiedAt: new Date(),
    };
  });

  console.log("🤝 Creating community memberships (primary + verified)...");
  await db.insert(communityMemberships).values(memberships);
  console.log(`✅ Created ${memberships.length} primary memberships`);

  // 5. Visibility — for every user, one row per community in their primary's
  // network, all is_visible = true.
  const communityNetworkMap = new Map(
    allCommunities.map((c) => [c.id, c.networkId]),
  );
  const networkCommunitiesMap = new Map<string, typeof allCommunities>();
  for (const c of allCommunities) {
    if (!c.networkId) continue;
    const arr = networkCommunitiesMap.get(c.networkId) ?? [];
    arr.push(c);
    networkCommunitiesMap.set(c.networkId, arr);
  }

  const visibilityRows: {
    userId: string;
    communityId: string;
    isVisible: boolean;
  }[] = [];
  for (const m of memberships) {
    const networkId = communityNetworkMap.get(m.communityId);
    if (!networkId) continue;
    const networkCommunities = networkCommunitiesMap.get(networkId) ?? [];
    for (const c of networkCommunities) {
      visibilityRows.push({
        userId: m.userId,
        communityId: c.id,
        isVisible: true,
      });
    }
  }

  console.log("👀 Creating community_visibility rows...");
  await db.insert(communityVisibility).values(visibilityRows);
  console.log(`✅ Created ${visibilityRows.length} visibility rows`);

  // Log per-community summary
  for (const c of allCommunities) {
    const memberCount = memberships.filter(
      (m) => m.communityId === c.id,
    ).length;
    const adminCount = memberships.filter(
      (m) => m.communityId === c.id && m.role === "admin",
    ).length;
    const networkLabel =
      c.networkId === kcMetro.id ? "KC Metro" : "Test Network";
    console.log(
      `🏘️ [${networkLabel}] ${c.name}: ${memberCount} members (${adminCount} admin)`,
    );
  }

  console.log("🎉 Communities seeding completed!");
}
