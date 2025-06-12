import { faker } from "@faker-js/faker";
import { InferInsertModel } from "drizzle-orm";
import "dotenv/config";
import { db } from "../db";
import { messages } from "../schemas/messages";
import { users } from "../schemas/users";

// Types

type NewMessage = InferInsertModel<typeof messages>;

async function main() {
  console.log("🌱 Seeding messages...");

  await db.delete(messages);

  const allUsers = await db.select().from(users);
  if (allUsers.length < 2) throw new Error("Seed at least 2 users first");

  const seedMessages: NewMessage[] = [];

  // Generate fake conversations
  for (let i = 0; i < 1000; i++) {
    const sender = faker.helpers.arrayElement(allUsers);
    const receiver = faker.helpers.arrayElement(
      allUsers.filter((u) => u.id !== sender.id),
    );

    const conversationId = faker.string.uuid();

    const createdAt = faker.date.recent({ days: 30 });
    const status = faker.helpers.arrayElement(["sent", "delivered", "read"]);

    const message: NewMessage = {
      id: faker.string.uuid(),
      conversationId,
      senderId: sender.id,
      receiverId: receiver.id,
      content: faker.lorem.sentences({ min: 1, max: 3 }),
      attachments: [],
      status,
      readAt:
        status === "read"
          ? faker.date.soon({ days: 5, refDate: createdAt })
          : null,
      createdAt,
    };

    seedMessages.push(message);
  }

  await db.insert(messages).values(seedMessages);

  console.log("✅ Messages seed complete");
}

main().catch((err) => {
  console.error("❌ Error seeding messages:", err);
  process.exit(1);
});
