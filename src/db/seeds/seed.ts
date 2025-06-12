import "dotenv/config";

async function runSeed(file: string) {
  console.log(`\n🌱 Running ${file}...`);
  await import(`./${file}`);
}

async function main() {
  const seedFiles = [
    "users.ts",
    "tools.ts",
    "rentals.ts",
    "payments.ts",
    "notifications.ts",
    "messages.ts",
    "collections.ts",
  ];

  for (const file of seedFiles) {
    await runSeed(file);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("\n✅ All seed scripts completed");
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
