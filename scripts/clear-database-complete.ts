import { db } from "../src/db/db";

const dbUrl = process.env.DATABASE_URL ?? "";
const isLocalDb = /localhost|127\.0\.0\.1/.test(dbUrl);
if (process.env.NODE_ENV === "production" || !isLocalDb) {
  console.error(
    "REFUSING to clear a non-local database.\n" +
      `DATABASE_URL host is not localhost (or NODE_ENV is production).\n` +
      "This script DROPS ALL TABLES. It only runs against local databases.",
  );
  process.exit(1);
}

async function clearDatabaseComplete() {
  console.log("🗑️  Completely clearing database...");

  try {
    // Drop all possible tables including better-auth tables
    const tablesToDrop = [
      "collection_items",
      "user_collections",
      "notifications",
      "messages",
      "user_favorites",
      "reviews",
      "rentals",
      "rental_requests",
      "payments",
      "user_payment_methods",
      "user_preferences",
      "user_addresses",
      "listing_availability",
      "listing_images",
      "listings",
      "listing_categories",
      "user_sessions",
      // Better-auth tables
      "user",
      "session",
      "account",
      "verification",
      "users",
    ];

    for (const table of tablesToDrop) {
      try {
        await db.execute(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        console.log(`✅ Dropped table: ${table}`);
      } catch (error) {
        console.log(`⚠️  Could not drop table ${table}:`, error);
      }
    }

    // Drop all possible enums
    const enumsToDrop = [
      "user_status",
      "listing_status",
      "rental_status",
      "payment_status",
      "message_status",
      "notification_status",
    ];

    for (const enumName of enumsToDrop) {
      try {
        await db.execute(`DROP TYPE IF EXISTS "${enumName}" CASCADE`);
        console.log(`✅ Dropped enum: ${enumName}`);
      } catch (error) {
        console.log(`⚠️  Could not drop enum ${enumName}:`, error);
      }
    }

    // Also try to drop any remaining tables by getting all table names
    try {
      const result = await db.execute(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
      `);

      const remainingTables = result.rows.map(
        (row: Record<string, unknown>) => row.tablename as string,
      );

      if (remainingTables.length > 0) {
        console.log("📋 Remaining tables found:", remainingTables);

        for (const table of remainingTables) {
          try {
            await db.execute(`DROP TABLE IF EXISTS "${table}" CASCADE`);
            console.log(`✅ Dropped remaining table: ${table}`);
          } catch (error) {
            console.log(`⚠️  Could not drop remaining table ${table}:`, error);
          }
        }
      }
    } catch (error) {
      console.log("⚠️  Could not check for remaining tables:", error);
    }

    console.log("🎉 Database completely cleared!");
    console.log("📝 You can now run: npx drizzle-kit push");
  } catch (error) {
    console.error("❌ Error clearing database:", error);
  } finally {
    process.exit(0);
  }
}

clearDatabaseComplete();
