import { faker } from "@faker-js/faker";
import { InferInsertModel } from "drizzle-orm";
import "dotenv/config";
import { db } from "../db-seed"; // Use WebSocket driver for Node.js compatibility
import { notifications } from "../schemas/notifications.schema";
import { user } from "../schemas/user.schema";

type NewNotification = InferInsertModel<typeof notifications>;

async function main(): Promise<void> {
  console.log("🌱 Seeding notifications...");

  const allUsers = await db.select().from(user);

  if (allUsers.length === 0) {
    throw new Error("No users found. Seed users first.");
  }

  const types = [
    "rental_request_created",
    "rental_approved",
    "rental_denied",
    "rental_started",
    "rental_ended",
    "rental_cancelled",
    "rental_reminder",
    "payment_succeeded",
    "payment_failed",
    "review_received",
    "system",
  ] as const;

  const seedNotifications: NewNotification[] = [];

  for (let i = 0; i < 20; i++) {
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

export { main };
