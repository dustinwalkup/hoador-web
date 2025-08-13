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
  } catch (error) {
    console.error(`❌ Error in ${file}:`, error);
    throw error; // Re-throw to stop the seeding process
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
    "tools.seed.ts",
    "rentals.seed.ts",
    "payments.seed.ts",
    "notifications.seed.ts",
    "messages.seed.ts",
    "message-attachments.seed.ts",
    "collections.seed.ts",
  ];

  for (const file of seedFiles) {
    await runSeed(file);
    // Reset database connection to prevent deadlocks
    await resetDatabaseConnection();
    // Give database time to settle between seeds
    console.log(`⏳ Waiting 2 seconds before next seed...`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log("\n✅ All seed scripts completed");
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
