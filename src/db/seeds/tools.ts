import { faker } from "@faker-js/faker";
import { InferInsertModel } from "drizzle-orm";
import "dotenv/config";
import { db } from "../db";
import { tools, toolCategories, toolAvailability } from "../schemas/tools";
import { users } from "../schemas/users";

// Infer types

type NewTool = InferInsertModel<typeof tools>;
type NewCategory = InferInsertModel<typeof toolCategories>;
type NewAvailability = InferInsertModel<typeof toolAvailability>;

async function main() {
  console.log("🌱 Seeding tools and availability...");

  await db.delete(toolAvailability);
  await db.delete(tools);
  await db.delete(toolCategories);

  const allUsers = await db.select().from(users);

  if (allUsers.length === 0) {
    throw new Error("No users found. Run user seed first.");
  }

  const categories: NewCategory[] = [
    {
      id: faker.string.uuid(),
      name: "Power Tools",
      description: "Electric tools like drills",
      icon: "drill",
      parentId: null,
      sortOrder: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: faker.string.uuid(),
      name: "Hand Tools",
      description: "Non-powered hand tools",
      icon: "wrench",
      parentId: null,
      sortOrder: 2,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: faker.string.uuid(),
      name: "Gardening",
      description: "Yard and garden tools",
      icon: "shovel",
      parentId: null,
      sortOrder: 3,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: faker.string.uuid(),
      name: "Ladders & Access",
      description: "Ladders and scaffolding",
      icon: "ladder",
      parentId: null,
      sortOrder: 4,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: faker.string.uuid(),
      name: "Construction",
      description: "Heavy-duty construction tools",
      icon: "hammer",
      parentId: null,
      sortOrder: 5,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: faker.string.uuid(),
      name: "Cleaning",
      description: "Tools for cleaning tasks",
      icon: "vacuum",
      parentId: null,
      sortOrder: 6,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: faker.string.uuid(),
      name: "Automotive",
      description: "Car repair tools",
      icon: "jack",
      parentId: null,
      sortOrder: 7,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: faker.string.uuid(),
      name: "Party Equipment",
      description: "Event gear like tents",
      icon: "tent",
      parentId: null,
      sortOrder: 8,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await db.insert(toolCategories).values(categories);

  const seedTools: NewTool[] = [];
  const seedAvailability: NewAvailability[] = [];

  for (let i = 0; i < 30; i++) {
    const owner = faker.helpers.arrayElement(allUsers);
    const category = faker.helpers.arrayElement(categories);
    const toolId = faker.string.uuid();

    if (!category || !category.id)
      throw new Error("Failed to get a valid category");

    const tool: NewTool = {
      id: toolId,
      ownerId: owner.id,
      categoryId: category.id,
      name: faker.commerce.productName() + " " + faker.word.adjective(),
      description: faker.commerce.productDescription(),
      brand: faker.company.name(),
      model: faker.string.alphanumeric(8),
      condition: faker.helpers.arrayElement(["new", "good", "fair", "poor"]),
      dailyRate: faker.number
        .float({ min: 10, max: 100, multipleOf: 0.01 })
        .toString(),
      weeklyRate: faker.datatype.boolean()
        ? faker.number.float({ min: 60, max: 500, multipleOf: 0.01 }).toString()
        : null,
      monthlyRate: faker.datatype.boolean()
        ? faker.number
            .float({ min: 200, max: 1500, multipleOf: 0.01 })
            .toString()
        : null,
      securityDeposit: faker.number
        .float({ min: 0, max: 200, multipleOf: 0.01 })
        .toString(),
      status: "available",
      images: [faker.image.urlPicsumPhotos()],
      specifications: {
        weight: faker.number.float({ min: 1, max: 20 }),
        voltage: 120,
        usage: "household",
      },
      instructions: faker.lorem.sentences(2),
      safetyNotes: faker.lorem.sentences(1),
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 30,
      requiresPickup: faker.datatype.boolean(),
      deliveryAvailable: faker.datatype.boolean(),
      deliveryFee: faker.number
        .float({ min: 0, max: 25, multipleOf: 0.01 })
        .toString(),
      deliveryRadius: faker.number.int({ min: 0, max: 10 }),
      isActive: true,
      viewCount: faker.number.int({ min: 0, max: 100 }),
      favoriteCount: faker.number.int({ min: 0, max: 20 }),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Create 1–3 availability entries per tool
    const count = faker.number.int({ min: 1, max: 3 });
    for (let j = 0; j < count; j++) {
      const start = faker.date.soon({ days: 30 });
      const end = faker.date.soon({ days: 5, refDate: start });

      seedAvailability.push({
        id: faker.string.uuid(),
        toolId,
        startDate: start,
        endDate: end,
        isBlocked: faker.datatype.boolean(),
        reason: faker.lorem.words(3),
        createdAt: new Date(),
      });
    }

    seedTools.push(tool);
  }

  await db.insert(tools).values(seedTools);
  await db.insert(toolAvailability).values(seedAvailability);

  console.log("✅ Tool and availability seed complete");
}

main().catch((err) => {
  console.error("❌ Error seeding tools:", err);
  process.exit(1);
});
