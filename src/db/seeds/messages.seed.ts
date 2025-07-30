import { InferInsertModel } from "drizzle-orm";
import { db } from "../db";
import { faker } from "@faker-js/faker";
import { conversations, messages } from "../schemas/messages.schema";
import { users } from "../schemas/users.schema";

// Types
type NewConversation = InferInsertModel<typeof conversations>;
type NewMessage = InferInsertModel<typeof messages>;

async function main() {
  console.log("🌱 Seeding messages...");

  // Clear existing data
  await db.delete(messages);
  await db.delete(conversations);

  const allUsers = await db.select().from(users);
  if (allUsers.length < 2) throw new Error("Seed at least 2 users first");

  const seedConversations: NewConversation[] = [];
  const seedMessages: NewMessage[] = [];
  const usedUserPairs = new Set<string>();

  // Generate fake conversations
  for (let i = 0; i < 50; i++) {
    // Find a unique user pair
    let user1: (typeof allUsers)[0] | undefined;
    let user2: (typeof allUsers)[0] | undefined;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      user1 = faker.helpers.arrayElement(allUsers);
      user2 = faker.helpers.arrayElement(
        allUsers.filter((u) => u.id !== user1?.id),
      );

      // Create a unique key for this pair (sort to ensure consistency)
      const pairKey = [user1?.id, user2?.id].sort().join("-");
      attempts++;

      if (!usedUserPairs.has(pairKey)) {
        usedUserPairs.add(pairKey);
        break;
      }
    } while (attempts < maxAttempts);

    // If we can't find a unique pair, skip this iteration
    if (attempts >= maxAttempts || !user1 || !user2) {
      console.log(
        `⚠️ Skipping conversation ${i + 1} - no unique user pairs available`,
      );
      continue;
    }

    const conversation: NewConversation = {
      id: faker.string.uuid(),
      user1Id: user1.id,
      user2Id: user2.id,
      lastMessageAt: faker.date.recent({ days: 30 }),
      user1LastReadAt: faker.date.recent({ days: 7 }),
      user2LastReadAt: faker.date.recent({ days: 7 }),
      user1Archived: faker.datatype.boolean(),
      user2Archived: faker.datatype.boolean(),
      createdAt: faker.date.recent({ days: 60 }),
    };

    seedConversations.push(conversation);

    // Generate 2-10 messages per conversation
    const messageCount = faker.number.int({ min: 2, max: 10 });
    const conversationCreatedAt = conversation.createdAt;

    for (let j = 0; j < messageCount; j++) {
      const isUser1 = j % 2 === 0; // Alternate between users
      const senderId = isUser1 ? user1.id : user2.id;

      const messageCreatedAt = faker.date.between({
        from: conversationCreatedAt || new Date(),
        to: new Date(),
      });

      const status = faker.helpers.arrayElement([
        "sent",
        "delivered",
        "read",
      ]) as "sent" | "delivered" | "read";

      const message: NewMessage = {
        id: faker.string.uuid(),
        conversationId: conversation.id!,
        senderId,
        content: faker.lorem.sentences({ min: 1, max: 3 }) || "Hello!",
        attachments: [],
        status,
        rentalId: null, // Optional: can be linked to rentals later
        editedAt: null,
        createdAt: messageCreatedAt!,
      };

      seedMessages.push(message);
    }
  }

  // Insert conversations first, then messages
  await db.insert(conversations).values(seedConversations);
  await db.insert(messages).values(seedMessages);

  console.log("✅ Messages seed complete");
}

main().catch((err) => {
  console.error("❌ Error seeding messages:", err);
  process.exit(1);
});
