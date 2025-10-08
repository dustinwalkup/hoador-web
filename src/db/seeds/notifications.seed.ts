import { faker } from "@faker-js/faker";
import { InferInsertModel } from "drizzle-orm";
import "dotenv/config";
import { db } from "../db-seed"; // Use WebSocket driver for Node.js compatibility
import { notifications } from "../schemas/notifications.schema";
import { user } from "../schemas/user.schema";

type NewNotification = InferInsertModel<typeof notifications>;

async function main() {
  console.log("🌱 Seeding notifications...");

  await db.delete(notifications);

  const allUsers = await db.select().from(user);

  if (allUsers.length === 0) {
    throw new Error("No users found. Seed users first.");
  }

  const types = [
    "rental_request",
    "rental_approved",
    "rental_reminder",
    "payment",
    "review",
    "system",
  ] as const;

  const seedNotifications: NewNotification[] = [];

  for (let i = 0; i < 100; i++) {
    const user = faker.helpers.arrayElement(allUsers);
    const type = faker.helpers.arrayElement(types);

    const notification: NewNotification = {
      id: faker.string.uuid(),
      userId: user.id,
      type,
      title: faker.word.adjective() + " " + type.replace("_", " "),
      message: faker.lorem.sentence(),
      data: {
        referenceId: faker.string.uuid(),
        priority: faker.helpers.arrayElement(["low", "normal", "high"]),
        link: "/dashboard/notifications",
      },
      isRead: faker.datatype.boolean(),
      readAt: faker.datatype.boolean() ? faker.date.recent() : null,
      createdAt: faker.date.recent({ days: 14 }),
    };

    seedNotifications.push(notification);
  }

  await db.insert(notifications).values(seedNotifications);

  console.log("✅ Notifications seed complete");
}

main().catch((err) => {
  console.error("❌ Error seeding notifications:", err);
  process.exit(1);
});
