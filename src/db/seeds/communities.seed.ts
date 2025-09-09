import { db } from "../db";
import {
  communities,
  communityMemberships,
} from "../schemas/communities.schema";
import { user } from "../schemas/user.schema";

export async function main() {
  console.log("🏘️ Seeding communities...");

  // Create sample communities
  const sampleCommunities = [
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
  ];

  // Insert communities
  console.log("📍 Creating communities...");
  const insertedCommunities = await db
    .insert(communities)
    .values(sampleCommunities)
    .returning();

  console.log(`✅ Created ${insertedCommunities.length} communities`);

  // Get all user to assign them to communities
  const allUsers = await db.select().from(user);
  console.log(`👥 Found ${allUsers.length} users to assign to communities`);

  if (allUsers.length === 0) {
    console.log("⚠️ No user found - make sure user.seed.ts runs before this");
    return;
  }

  // Assign users to communities (distribute evenly)
  const memberships = [];
  for (let i = 0; i < allUsers.length; i++) {
    const communityIndex = i % insertedCommunities.length;
    const community = insertedCommunities[communityIndex];
    const user = allUsers[i];

    // Make the first user in each community an admin
    const role = i < insertedCommunities.length ? "admin" : "member";

    memberships.push({
      userId: user.id,
      communityId: community.id,
      role: role as "admin" | "member",
    });
  }

  // Insert memberships
  console.log("🤝 Creating community memberships...");
  const insertedMemberships = await db
    .insert(communityMemberships)
    .values(memberships)
    .returning();

  console.log(`✅ Created ${insertedMemberships.length} community memberships`);

  // Log community assignments
  for (const community of insertedCommunities) {
    const memberCount = memberships.filter(
      (m) => m.communityId === community.id,
    ).length;
    const adminCount = memberships.filter(
      (m) => m.communityId === community.id && m.role === "admin",
    ).length;
    console.log(
      `🏘️ ${community.name} (${community.joinCode}): ${memberCount} members (${adminCount} admins)`,
    );
  }

  console.log("🎉 Communities seeding completed!");
}
