import { InferInsertModel } from "drizzle-orm";
import { db } from "../db";
import { faker } from "@faker-js/faker";
import { messageAttachments } from "../schemas/messages.schema";
import { messages } from "../schemas/messages.schema";

// Types
type NewMessageAttachment = InferInsertModel<typeof messageAttachments>;

async function main() {
  console.log("🌱 Seeding message attachments...");

  // Clear existing data
  await db.delete(messageAttachments);

  // Get all messages to attach files to
  const allMessages = await db.select().from(messages);
  if (allMessages.length === 0) {
    console.log("⚠️ No messages found. Run messages seed first.");
    return;
  }

  const seedAttachments: NewMessageAttachment[] = [];
  let attachmentCount = 0;

  // Sample file types and their properties
  const fileTypes = [
    {
      type: "image" as const,
      mimeTypes: ["image/jpeg", "image/png", "image/webp"],
      extensions: [".jpg", ".png", ".webp"],
      sizes: [1024 * 1024, 2 * 1024 * 1024, 3 * 1024 * 1024], // 1-3MB
    },
    {
      type: "pdf" as const,
      mimeTypes: ["application/pdf"],
      extensions: [".pdf"],
      sizes: [500 * 1024, 1024 * 1024, 2 * 1024 * 1024], // 500KB-2MB
    },
    {
      type: "document" as const,
      mimeTypes: [
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      extensions: [".doc", ".docx"],
      sizes: [100 * 1024, 500 * 1024, 1024 * 1024], // 100KB-1MB
    },
    {
      type: "spreadsheet" as const,
      mimeTypes: [
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
      extensions: [".xls", ".xlsx"],
      sizes: [200 * 1024, 800 * 1024, 1.5 * 1024 * 1024], // 200KB-1.5MB
    },
    {
      type: "text" as const,
      mimeTypes: ["text/plain"],
      extensions: [".txt"],
      sizes: [1 * 1024, 5 * 1024, 10 * 1024], // 1-10KB
    },
  ];

  // Sample filenames for each type
  const sampleFilenames = {
    image: [
      "tool-photo.jpg",
      "receipt-scan.png",
      "work-progress.webp",
      "damage-documentation.jpg",
      "before-after.png",
    ],
    pdf: [
      "rental-agreement.pdf",
      "safety-manual.pdf",
      "maintenance-guide.pdf",
      "invoice.pdf",
      "instructions.pdf",
    ],
    document: [
      "rental-contract.docx",
      "tool-specifications.doc",
      "user-manual.docx",
      "terms-conditions.doc",
      "liability-waiver.docx",
    ],
    spreadsheet: [
      "rental-schedule.xlsx",
      "inventory-list.xls",
      "cost-breakdown.xlsx",
      "maintenance-log.xls",
      "usage-tracking.xlsx",
    ],
    text: [
      "notes.txt",
      "instructions.txt",
      "contact-info.txt",
      "reminder.txt",
      "checklist.txt",
    ],
  };

  // Add attachments to some messages (not all messages need attachments)
  for (const message of allMessages) {
    // 30% chance of having attachments
    if (faker.datatype.boolean({ probability: 0.3 })) {
      // 1-3 attachments per message
      const attachmentCountForMessage = faker.number.int({ min: 1, max: 3 });

      for (let i = 0; i < attachmentCountForMessage; i++) {
        const fileType = faker.helpers.arrayElement(fileTypes);
        const mimeType = faker.helpers.arrayElement(fileType.mimeTypes);
        const extension = faker.helpers.arrayElement(fileType.extensions);
        const size = faker.helpers.arrayElement(fileType.sizes);
        const filename = faker.helpers.arrayElement(
          sampleFilenames[fileType.type],
        );

        // Generate a unique blob pathname for storage
        const blobPathname = `message-attachments/${message.id}/${faker.string.uuid()}${extension}`;

        // Generate a placeholder URL (in production this would be the actual blob URL)
        const url = `https://example.com/attachments/${blobPathname}`;

        const attachment: NewMessageAttachment = {
          id: faker.string.uuid(),
          messageId: message.id,
          filename: faker.string.uuid() + extension, // Unique filename for storage
          originalFilename: filename,
          mimeType,
          type: fileType.type,
          size,
          url,
          blobPathname,
          width:
            fileType.type === "image"
              ? faker.number.int({ min: 800, max: 1920 })
              : null,
          height:
            fileType.type === "image"
              ? faker.number.int({ min: 600, max: 1080 })
              : null,
          orderIndex: i,
          createdAt: faker.date.between({
            from: message.createdAt,
            to: new Date(),
          }),
        };

        seedAttachments.push(attachment);
        attachmentCount++;
      }
    }
  }

  // Insert attachments
  if (seedAttachments.length > 0) {
    await db.insert(messageAttachments).values(seedAttachments);
  }

  console.log(
    `✅ Message attachments seed complete - Created ${attachmentCount} attachments across ${seedAttachments.length > 0 ? seedAttachments.length : 0} messages`,
  );
}

main().catch((err) => {
  console.error("❌ Error seeding message attachments:", err);
  process.exit(1);
});
