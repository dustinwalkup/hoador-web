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
  let archivedConversationCount = 0;
  const targetArchivedConversations = Math.min(
    3,
    Math.floor(allUsers.length / 2),
  ); // Ensure at least 3 archived conversations

  // Generate conversations for each user
  for (const user of allUsers) {
    // Each user should have 3-8 conversations
    const conversationCount = faker.number.int({ min: 3, max: 8 });

    // Get other users to create conversations with
    const otherUsers = allUsers.filter((u) => u.id !== user.id);

    // Shuffle other users to get random selection
    const shuffledUsers = faker.helpers.shuffle(otherUsers);

    for (let i = 0; i < conversationCount && i < shuffledUsers.length; i++) {
      const otherUser = shuffledUsers[i];

      // Create a unique key for this pair (sort to ensure consistency)
      const pairKey = [user.id, otherUser.id].sort().join("-");

      // Skip if this pair already has a conversation
      if (usedUserPairs.has(pairKey)) {
        continue;
      }

      usedUserPairs.add(pairKey);

      // Ensure we have some archived conversations
      const shouldArchive =
        archivedConversationCount < targetArchivedConversations
          ? faker.datatype.boolean({ probability: 0.8 }) // Higher probability if we need more archived
          : faker.datatype.boolean({ probability: 0.3 }); // Normal probability otherwise

      const user1Archived = shouldArchive;
      const user2Archived = shouldArchive;

      if (user1Archived || user2Archived) {
        archivedConversationCount++;
      }

      const conversation: NewConversation = {
        id: faker.string.uuid(),
        user1Id: user.id,
        user2Id: otherUser.id,
        lastMessageAt: faker.date.recent({ days: 30 }),
        user1LastReadAt: faker.date.recent({ days: 7 }),
        user2LastReadAt: faker.date.recent({ days: 7 }),
        user1Archived,
        user2Archived,
        createdAt: faker.date.recent({ days: 60 }),
      };

      seedConversations.push(conversation);

      // Generate 2-15 messages per conversation (more varied)
      const messageCount = faker.number.int({ min: 2, max: 15 });
      const conversationCreatedAt = conversation.createdAt;

      for (let j = 0; j < messageCount; j++) {
        const isUser1 = j % 2 === 0; // Alternate between users
        const senderId = isUser1 ? user.id : otherUser.id;

        const messageCreatedAt = faker.date.between({
          from: conversationCreatedAt || new Date(),
          to: new Date(),
        });

        const status = faker.helpers.arrayElement([
          "sent",
          "delivered",
          "read",
        ]) as "sent" | "delivered" | "read";

        // Generate more varied message content
        const messageContent =
          faker.helpers.arrayElement([
            faker.lorem.sentences({ min: 1, max: 3 }),
            faker.lorem.paragraph({ min: 1, max: 2 }),
            faker.lorem.sentence({ min: 5, max: 15 }),
            "Hey! How's it going?",
            "Thanks for the tool!",
            "When can I pick it up?",
            "Perfect, see you then!",
            "Is it still available?",
            "Can you deliver it?",
            "What's the condition like?",
            "Great, I'll be there at 3pm",
            "Do you have any other tools?",
            "Thanks for the quick response!",
            "I'll bring it back tomorrow",
            "Works perfectly, thanks!",
          ]) || "Hello!";

        const message: NewMessage = {
          id: faker.string.uuid(),
          conversationId: conversation.id!,
          senderId,
          content: messageContent,
          attachments: [],
          status,
          rentalId: null, // Optional: can be linked to rentals later
          editedAt: null,
          createdAt: messageCreatedAt!,
        };

        seedMessages.push(message);
      }
    }
  }

  // Insert conversations first, then messages
  await db.insert(conversations).values(seedConversations);
  await db.insert(messages).values(seedMessages);

  console.log(
    `✅ Messages seed complete - Created ${seedConversations.length} conversations with ${seedMessages.length} messages (${archivedConversationCount} archived)`,
  );
}

main().catch((err) => {
  console.error("❌ Error seeding messages:", err);
  process.exit(1);
});
