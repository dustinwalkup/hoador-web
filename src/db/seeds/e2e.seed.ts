/**
 * E2E seed: community, legal documents, baseline users for auth E2E tests.
 * Load .env.test and use E2E db. Run via tsx src/db/seeds/e2e.seed.ts or from globalSetup.
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

import { hashPassword } from "better-auth/crypto";
import { db } from "../db-e2e";
import {
  user,
  account,
  userAddresses,
  userPreferences,
} from "../schemas/user.schema";
import {
  communities,
  communityMemberships,
  communityNetworks,
  communityVisibility,
} from "../schemas/communities.schema";
import { legalDocuments } from "../schemas/legal-documents.schema";
import { LEGAL_DOCUMENT_IDS } from "../../constants/legal-documents";

export const E2E_JOIN_CODE = "E2E-JOIN-CODE";
export const E2E_PASSWORD = "E2eTestPassword1!";
export const E2E_PRIMARY_COMMUNITY_NAME = "Foxcroft";

const KC_METRO_SLUG = "kansas-city-metro";
const TEST_NETWORK_SLUG = "test-network";

// Subset of the dev seed list — Foxcroft is required for the new
// community-select e2e flow; the others give a realistic dropdown.
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

type UserStatus =
  | "pending_verification"
  | "email_verified"
  | "incomplete_profile"
  | "active";

type E2ESeedUser = {
  email: string;
  name: string;
  status: UserStatus;
  userType: "standard" | "admin";
  emailVerified: boolean;
  /** Member of the legacy `E2E_JOIN_CODE` community (Test Network), verified. */
  withCommunity: boolean;
  /**
   * Alternative to `withCommunity`: a primary membership in a named KC Metro
   * community plus visibility rows for the whole KC Metro network. Used by the
   * community-select / visibility / admin-verification flows.
   */
  kcMembership?: {
    community: string;
    verificationStatus: "verified" | "pending";
  };
};

const E2E_USERS: readonly E2ESeedUser[] = [
  {
    email: "active@e2e.test",
    name: "Active User",
    status: "active",
    userType: "standard",
    emailVerified: true,
    withCommunity: true,
  },
  {
    email: "email_verified@e2e.test",
    name: "Email Verified User",
    status: "email_verified",
    userType: "standard",
    emailVerified: true,
    withCommunity: false,
  },
  {
    email: "incomplete@e2e.test",
    name: "Incomplete User",
    status: "incomplete_profile",
    userType: "standard",
    emailVerified: true,
    withCommunity: true,
  },
  {
    email: "unverified@e2e.test",
    name: "Unverified User",
    status: "pending_verification",
    userType: "standard",
    emailVerified: false,
    withCommunity: false,
  },
  {
    email: "password_reset@e2e.test",
    name: "Password Reset User",
    status: "active",
    userType: "standard",
    emailVerified: true,
    withCommunity: true,
  },
  {
    email: "admin@e2e.test",
    name: "E2E Admin",
    status: "active",
    userType: "admin",
    emailVerified: true,
    withCommunity: true,
  },
  {
    email: "google@e2e.test",
    name: "Google User",
    status: "active",
    userType: "standard",
    emailVerified: true,
    withCommunity: true,
  },
  {
    // Active KC Metro member with full network visibility — drives the
    // visibility-settings e2e (toggle a non-primary community off).
    email: "metro_member@e2e.test",
    name: "Metro Member",
    status: "active",
    userType: "standard",
    emailVerified: true,
    withCommunity: false,
    kcMembership: { community: "Foxcroft", verificationStatus: "verified" },
  },
  {
    // Onboarded but still awaiting admin verification — drives the admin
    // verification-queue e2e and the "verification pending" profile badge.
    email: "pending_member@e2e.test",
    name: "Pending Member",
    status: "active",
    userType: "standard",
    emailVerified: true,
    withCommunity: false,
    kcMembership: {
      community: "Glen Arbor Estates",
      verificationStatus: "pending",
    },
  },
];

const LEGAL_VERSION = "1.0";
const LEGAL_URL_PLACEHOLDER = "https://example.com/legal/placeholder.pdf";

async function main(): Promise<void> {
  console.log("🌱 E2E seed: legal documents, networks, communities, users...");

  const now = new Date();
  const hashedPassword = await hashPassword(E2E_PASSWORD);

  // 1. Legal documents required at signup (TOS, Privacy, Community Guidelines)
  const legalRows = [
    {
      id: LEGAL_DOCUMENT_IDS.TOS,
      version: LEGAL_VERSION,
      publishedAt: now,
      url: LEGAL_URL_PLACEHOLDER,
    },
    {
      id: LEGAL_DOCUMENT_IDS.PRIVACY,
      version: LEGAL_VERSION,
      publishedAt: now,
      url: LEGAL_URL_PLACEHOLDER,
    },
    {
      id: LEGAL_DOCUMENT_IDS.COMMUNITY,
      version: LEGAL_VERSION,
      publishedAt: now,
      url: LEGAL_URL_PLACEHOLDER,
    },
  ];
  await db.insert(legalDocuments).values(legalRows);
  console.log("✅ Legal documents seeded");

  // 2. Networks
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
        description: "E2E private-invite network (preserves E2E_JOIN_CODE).",
      },
    ])
    .returning();
  if (!kcMetro || !testNetwork) {
    throw new Error("E2E network insert failed");
  }
  console.log("✅ Networks seeded (KC Metro, Test Network)");

  // 3. Test Network: legacy private-invite community (preserves E2E_JOIN_CODE)
  const [legacyCommunity] = await db
    .insert(communities)
    .values({
      name: "E2E Test Community",
      joinCode: E2E_JOIN_CODE,
      networkId: testNetwork.id,
    })
    .returning();
  if (!legacyCommunity) {
    throw new Error("E2E legacy community insert failed");
  }
  console.log(`✅ Legacy community seeded (join code: ${E2E_JOIN_CODE})`);

  // 4. KC Metro communities for the new community-select flow
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
  console.log(`✅ KC Metro communities seeded (${kcCommunities.length})`);

  const foxcroft = kcCommunities.find(
    (c) => c.name === E2E_PRIMARY_COMMUNITY_NAME,
  );
  if (!foxcroft) {
    throw new Error(
      `Expected '${E2E_PRIMARY_COMMUNITY_NAME}' to be seeded into KC Metro`,
    );
  }

  // 5. Baseline users
  const userRows: (typeof user.$inferInsert)[] = [];
  const accountRows: (typeof account.$inferInsert)[] = [];
  const addressRows: (typeof userAddresses.$inferInsert)[] = [];
  const preferenceRows: (typeof userPreferences.$inferInsert)[] = [];
  const membershipRows: {
    userId: string;
    communityId: string;
    role: "admin" | "member";
    isPrimary: boolean;
    verificationStatus: "verified" | "pending";
    verifiedAt: Date | null;
  }[] = [];
  const visibilityRows: {
    userId: string;
    communityId: string;
    isVisible: boolean;
  }[] = [];

  for (const u of E2E_USERS) {
    const id = `e2e-${u.email.replace(/[@.]/g, "-")}`;
    userRows.push({
      id,
      name: u.name,
      email: u.email,
      emailVerified: u.emailVerified,
      image: null,
      firstName: u.name.split(" ")[0],
      lastName: u.name.split(" ")[1] ?? "",
      status: u.status,
      userType: u.userType,
      phone: null,
      bio: null,
      profileImageUrl: null,
      tosVersion: LEGAL_VERSION,
      tosAcceptedAt: now,
      privacyVersion: LEGAL_VERSION,
      privacyAcceptedAt: now,
      communityVersion: LEGAL_VERSION,
      communityAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const isGoogleUser = u.email === "google@e2e.test";
    accountRows.push({
      id: `acc-${id}`,
      accountId: isGoogleUser ? `e2e-google-${u.email}` : id,
      providerId: isGoogleUser ? "google" : "credential",
      userId: id,
      password: isGoogleUser ? undefined : hashedPassword,
      createdAt: now,
      updatedAt: now,
    });
    addressRows.push({
      userId: id,
      street: "123 E2E St",
      city: "Test City",
      state: "CA",
      zipCode: "90210",
      country: "US",
      isPrimary: true,
      createdAt: now,
      updatedAt: now,
    });
    preferenceRows.push({
      userId: id,
      createdAt: now,
      updatedAt: now,
    });
    if (u.kcMembership) {
      // KC Metro member: primary membership in the named community plus a
      // visibility row for every KC Metro community (matches what
      // initializeUserVisibility does for a real signup).
      const home = kcCommunities.find(
        (c) => c.name === u.kcMembership!.community,
      );
      if (!home) {
        throw new Error(
          `Expected KC Metro community '${u.kcMembership.community}' to be seeded`,
        );
      }
      const verified = u.kcMembership.verificationStatus === "verified";
      membershipRows.push({
        userId: id,
        communityId: home.id,
        role: u.userType === "admin" ? "admin" : "member",
        isPrimary: true,
        verificationStatus: u.kcMembership.verificationStatus,
        verifiedAt: verified ? now : null,
      });
      for (const c of kcCommunities) {
        visibilityRows.push({ userId: id, communityId: c.id, isVisible: true });
      }
    } else if (u.withCommunity) {
      // E2E users with a community land in the legacy E2E community (Test
      // Network) so the legacy /join-code path is exercisable. Their
      // visibility rows cover Test Network.
      membershipRows.push({
        userId: id,
        communityId: legacyCommunity.id,
        role: u.userType === "admin" ? "admin" : "member",
        isPrimary: true,
        verificationStatus: "verified",
        verifiedAt: now,
      });
      visibilityRows.push({
        userId: id,
        communityId: legacyCommunity.id,
        isVisible: true,
      });
    }
  }

  await db.insert(user).values(userRows);
  await db.insert(account).values(accountRows);
  await db.insert(userAddresses).values(addressRows);
  await db.insert(userPreferences).values(preferenceRows);
  await db.insert(communityMemberships).values(membershipRows);
  if (visibilityRows.length > 0) {
    await db.insert(communityVisibility).values(visibilityRows);
  }

  console.log(
    `✅ ${E2E_USERS.length} E2E users seeded (password: ${E2E_PASSWORD})`,
  );
  console.log(
    `✅ ${membershipRows.length} primary memberships, ${visibilityRows.length} visibility rows`,
  );
  console.log("🎉 E2E seed complete");
}

export { main };
