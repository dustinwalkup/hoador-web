import { config } from "dotenv";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function testMessageAttachmentsOnly() {
  console.log("🧪 Testing message attachments seed only...");

  try {
    // Import and run just the message attachments seed
    const messageAttachmentsSeed = await import(
      "./seeds/message-attachments.seed"
    );

    if (
      messageAttachmentsSeed.main &&
      typeof messageAttachmentsSeed.main === "function"
    ) {
      console.log("🌱 Running message attachments seed...");
      await messageAttachmentsSeed.main();
      console.log("✅ Message attachments seed completed successfully!");
    } else {
      console.log("⚠️ No main function found in message attachments seed");
    }
  } catch (error) {
    console.error("❌ Message attachments seed failed:", error);
    process.exit(1);
  }
}

testMessageAttachmentsOnly().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
