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
} from "../schemas/communities.schema";
import { legalDocuments } from "../schemas/legal-documents.schema";
import { LEGAL_DOCUMENT_IDS } from "../../constants/legal-documents";

export const E2E_JOIN_CODE = "E2E-JOIN-CODE";
export const E2E_PASSWORD = "E2eTestPassword1!";

const E2E_USERS = [
  {
    email: "active@e2e.test",
    name: "Active User",
    status: "active" as const,
    userType: "standard" as const,
    emailVerified: true,
    withCommunity: true,
  },
  {
    email: "email_verified@e2e.test",
    name: "Email Verified User",
    status: "email_verified" as const,
    userType: "standard" as const,
    emailVerified: true,
    withCommunity: false,
  },
  {
    email: "incomplete@e2e.test",
    name: "Incomplete User",
    status: "incomplete_profile" as const,
    userType: "standard" as const,
    emailVerified: true,
    withCommunity: true,
  },
  {
    email: "unverified@e2e.test",
    name: "Unverified User",
    status: "pending_verification" as const,
    userType: "standard" as const,
    emailVerified: false,
    withCommunity: false,
  },
  {
    email: "password_reset@e2e.test",
    name: "Password Reset User",
    status: "active" as const,
    userType: "standard" as const,
    emailVerified: true,
    withCommunity: true,
  },
  {
    email: "admin@e2e.test",
    name: "E2E Admin",
    status: "active" as const,
    userType: "admin" as const,
    emailVerified: true,
    withCommunity: true,
  },
  {
    email: "google@e2e.test",
    name: "Google User",
    status: "active" as const,
    userType: "standard" as const,
    emailVerified: true,
    withCommunity: true,
  },
] as const;

const LEGAL_VERSION = "1.0";
const LEGAL_URL_PLACEHOLDER = "https://example.com/legal/placeholder.pdf";

async function main(): Promise<void> {
  console.log("🌱 E2E seed: legal documents, community, users...");

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

  // 2. One community with E2E join code
  const [community] = await db
    .insert(communities)
    .values({
      name: "E2E Test Community",
      joinCode: E2E_JOIN_CODE,
    })
    .returning();
  if (!community) throw new Error("E2E community insert failed");
  console.log(`✅ Community seeded (join code: ${E2E_JOIN_CODE})`);

  // 3. Baseline users
  const userRows: (typeof user.$inferInsert)[] = [];
  const accountRows: (typeof account.$inferInsert)[] = [];
  const addressRows: (typeof userAddresses.$inferInsert)[] = [];
  const preferenceRows: (typeof userPreferences.$inferInsert)[] = [];
  const membershipRows: {
    userId: string;
    communityId: string;
    role: "admin" | "member";
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
    if (u.withCommunity) {
      membershipRows.push({
        userId: id,
        communityId: community.id,
        role: u.userType === "admin" ? "admin" : "member",
      });
    }
  }

  await db.insert(user).values(userRows);
  await db.insert(account).values(accountRows);
  await db.insert(userAddresses).values(addressRows);
  await db.insert(userPreferences).values(preferenceRows);
  await db.insert(communityMemberships).values(membershipRows);

  console.log(
    `✅ ${E2E_USERS.length} E2E users seeded (password: ${E2E_PASSWORD})`,
  );
  console.log("🎉 E2E seed complete");
}

export { main };
