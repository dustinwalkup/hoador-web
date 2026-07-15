import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../db-seed";

/**
 * Truncate all app and auth tables in one go. CASCADE ensures dependent tables
 * are truncated in correct order.
 */
async function truncateAll(): Promise<void> {
  console.log("\n🗑️ Truncating all tables...");
  await db.execute(
    sql.raw(`
    TRUNCATE TABLE
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
      neighborhood_need_listings,
      neighborhood_needs,
      service_bookings,
      service_listings,
      service_listing_categories,
      service_provider_profiles,
      blind_reviews,
      rentals,
      rental_requests,
      listing_images,
      listing_availability,
      listings,
      listing_categories,
      community_visibility,
      community_memberships,
      communities,
      community_networks,
      user_payment_methods,
      user_preferences,
      user_addresses,
      session,
      account,
      verification,
      "user"
    RESTART IDENTITY CASCADE
  `),
  );
  console.log("✅ All tables truncated");
}

async function runSeed(file: string): Promise<boolean> {
  console.log(`\n🌱 Running ${file}...`);
  try {
    const seedModule = await import(`./${file}`);
    if (seedModule.main && typeof seedModule.main === "function") {
      await seedModule.main();
    }
    console.log(`✅ ${file} completed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Error in ${file}:`, error);
    return false;
  }
}

async function main(): Promise<void> {
  await truncateAll();

  const seedFiles = [
    "users.seed.ts",
    "communities.seed.ts",
    "listings.seed.ts",
    "rentals.seed.ts",
    "payments.seed.ts",
    "notifications.seed.ts",
    "messages.seed.ts",
    "collections.seed.ts",
    "service-categories.seed.ts",
    "service-listings.seed.ts",
    "neighborhood-needs.seed.ts",
  ];

  let successCount = 0;
  let failureCount = 0;

  for (const file of seedFiles) {
    const success = await runSeed(file);
    if (success) {
      successCount++;
    } else {
      failureCount++;
      console.log(`⚠️ Continuing with next seed file...`);
    }
  }

  console.log("\n📊 Seeding Summary:");
  console.log(`✅ Successful: ${successCount}/${seedFiles.length}`);
  if (failureCount > 0) {
    console.log(`❌ Failed: ${failureCount}/${seedFiles.length}`);
    console.log(`⚠️ Some seeds failed, but the process continued`);
  } else {
    console.log(`🎉 All seed scripts completed successfully!`);
  }
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
