import "dotenv/config";
import { db } from "../db";

async function runSeed(file: string) {
  console.log(`\n🌱 Running ${file}...`);
  try {
    const seedModule = await import(`./${file}`);
    // Wait for the main function to complete if it exists
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

async function resetDatabaseConnection() {
  try {
    // Execute a simple query to reset the connection
    await db.execute("SELECT 1");
    console.log("🔄 Database connection reset");
  } catch (error) {
    console.warn("⚠️ Could not reset database connection:", error);
  }
}

async function main() {
  const seedFiles = [
    "users.seed.ts",
    "communities.seed.ts",
    "listings.seed.ts",
    "rentals.seed.ts",
    "payments.seed.ts",
    "notifications.seed.ts",
    "messages.seed.ts",
    "collections.seed.ts",
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

    // Reset database connection to prevent deadlocks
    await resetDatabaseConnection();

    // Give database time to settle between seeds
    if (file !== seedFiles[seedFiles.length - 1]) {
      // Don't wait after the last seed
      console.log(`⏳ Waiting 2 seconds before next seed...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
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
