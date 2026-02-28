/**
 * E2E database reset: truncate all tables (same list/order as src/db/seeds/seed.ts).
 * Uses DATABASE_URL from .env.test. Run after migrate, before E2E seed.
 */
import dotenv from "dotenv";
import path from "path";
import { sql } from "drizzle-orm";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

import { db } from "../src/db/db-e2e";

const TRUNCATE_LIST = `
  dispute_financial_operations,
  dispute_internal_notes,
  dispute_audit_logs,
  dispute_evidence,
  disputes,
  rental_agreement_documents,
  user_legal_acceptances,
  legal_documents,
  audit_logs,
  user_activity_log,
  push_notification_audit,
  push_subscriptions,
  notification_category_preferences,
  notifications,
  collection_items,
  user_collections,
  user_favorites,
  messages,
  conversations,
  payments,
  reviews,
  rentals,
  rental_requests,
  listing_images,
  listing_availability,
  listings,
  listing_categories,
  community_memberships,
  communities,
  user_payment_methods,
  user_preferences,
  user_addresses,
  session,
  account,
  verification,
  "user"
`;

export async function runE2EReset(): Promise<void> {
  console.log("🗑️ E2E: Truncating all tables...");
  await db.execute(
    sql.raw(`TRUNCATE TABLE ${TRUNCATE_LIST} RESTART IDENTITY CASCADE`),
  );
  console.log("✅ E2E tables truncated");
}
