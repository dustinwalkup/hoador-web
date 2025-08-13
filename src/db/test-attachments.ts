import "dotenv/config";
import { db } from "./db";
import { messages, messageAttachments } from "./schemas/messages.schema";
import { eq } from "drizzle-orm";

async function testAttachments() {
  console.log("🧪 Testing message attachments schema...");

  try {
    // Test 1: Query messages with attachments using relations
    console.log("\n📋 Test 1: Querying messages with attachments...");

    const messagesWithAttachments = await db.query.messages.findMany({
      with: {
        attachments: true,
        sender: true,
        conversation: {
          with: {
            user1: true,
            user2: true,
          },
        },
      },
      limit: 5,
    });

    console.log(`Found ${messagesWithAttachments.length} messages`);

    for (const message of messagesWithAttachments) {
      console.log(`\nMessage: "${message.content.substring(0, 50)}..."`);
      console.log(`Attachments: ${message.attachments.length}`);

      for (const attachment of message.attachments) {
        console.log(
          `  - ${attachment.originalFilename} (${attachment.type}, ${attachment.size} bytes)`,
        );
      }
    }

    // Test 2: Query attachments directly
    console.log("\n📎 Test 2: Querying attachments directly...");

    const allAttachments = await db.select().from(messageAttachments).limit(10);
    console.log(`Found ${allAttachments.length} attachments total`);

    // Group by type
    const attachmentsByType = allAttachments.reduce(
      (acc, attachment) => {
        acc[attachment.type] = (acc[attachment.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    console.log("Attachments by type:", attachmentsByType);

    // Test 3: Query specific message with attachments
    console.log("\n🔍 Test 3: Querying specific message with attachments...");

    if (messagesWithAttachments.length > 0) {
      const firstMessage = messagesWithAttachments[0];
      const specificMessage = await db.query.messages.findFirst({
        where: eq(messages.id, firstMessage.id),
        with: {
          attachments: {
            orderBy: (attachments, { asc }) => [asc(attachments.orderIndex)],
          },
          sender: true,
        },
      });

      if (specificMessage) {
        console.log(`Message ID: ${specificMessage.id}`);
        console.log(
          `Content: "${specificMessage.content.substring(0, 100)}..."`,
        );
        console.log(`Attachments: ${specificMessage.attachments.length}`);

        for (const attachment of specificMessage.attachments) {
          console.log(
            `  - ${attachment.originalFilename} (${attachment.mimeType})`,
          );
        }
      }
    }

    console.log("\n✅ All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testAttachments()
    .then(() => {
      console.log("🎉 Tests completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Tests failed:", error);
      process.exit(1);
    });
}

export { testAttachments };
