import { config } from "dotenv";
import { InferInsertModel } from "drizzle-orm";
import { db } from "../db";
import { faker } from "@faker-js/faker";
import { messageAttachments } from "../schemas/messages.schema";
import { messages } from "../schemas/messages.schema";
import { uploadToBlob } from "@/services/vercel-blob";
import { readFileSync } from "fs";
import { join } from "path";

// Load environment variables from .env.local
config({ path: ".env.local" });

// Types
type NewMessageAttachment = InferInsertModel<typeof messageAttachments>;

// Sample file data for seeding with real blob storage
const sampleFiles = {
  image: [
    {
      path: "public/images/mock/tools/automotive-stool.webp",
      mimeType: "image/webp",
    },
    { path: "public/images/mock/tools/car-wrench.jpg", mimeType: "image/jpeg" },
    {
      path: "public/images/mock/tools/cleaning-brush.jpg",
      mimeType: "image/jpeg",
    },
    { path: "public/images/mock/tools/hand-saw.jpeg", mimeType: "image/jpeg" },
    { path: "public/images/mock/tools/shovel.jpg", mimeType: "image/jpeg" },
    { path: "public/images/mock/tools/rake.webp", mimeType: "image/webp" },
    {
      path: "public/images/mock/tools/tape-measure.jpg",
      mimeType: "image/jpeg",
    },
    {
      path: "public/images/mock/tools/level-tool.webp",
      mimeType: "image/webp",
    },
  ],
  pdf: [
    {
      path: "public/images/mock/tools/garage-stock.png",
      mimeType: "image/png",
    }, // Using image as PDF placeholder
  ],
  document: [
    {
      path: "public/images/mock/tools/automotive-wrenches.jpg",
      mimeType: "image/jpeg",
    }, // Using image as document placeholder
  ],
  spreadsheet: [
    {
      path: "public/images/mock/tools/tire-lug-gun.webp",
      mimeType: "image/webp",
    }, // Using image as spreadsheet placeholder
  ],
  text: [
    {
      path: "public/images/mock/tools/cleaning-brush.jpg",
      mimeType: "image/jpeg",
    }, // Using image as text placeholder
  ],
};

async function uploadSampleFile(
  filePath: string,
): Promise<{ url: string; blobPathname: string; size: number }> {
  try {
    // Read the file from the public directory
    const fullPath = join(process.cwd(), filePath);
    const fileBuffer = readFileSync(fullPath);

    // Generate a unique filename for blob storage
    const filename = `message-attachments/${Date.now()}-${faker.string.uuid()}-${filePath.split("/").pop()}`;

    // Upload to blob storage
    const blobResult = await uploadToBlob(filename, fileBuffer);

    return {
      url: blobResult.url,
      blobPathname: blobResult.pathname,
      size: fileBuffer.length,
    };
  } catch (error) {
    console.error(`Failed to upload sample file ${filePath}:`, error);
    // Fallback to placeholder data
    return {
      url: `https://example.com/attachments/${filePath.split("/").pop()}`,
      blobPathname: `message-attachments/placeholder-${filePath.split("/").pop()}`,
      size: 1024 * 1024, // 1MB placeholder
    };
  }
}

async function main() {
  console.log("🌱 Seeding message attachments with real blob storage...");

  try {
    // Clear existing data
    console.log("🗑️ Clearing existing message attachments...");
    await db.delete(messageAttachments);
    console.log("✅ Existing attachments cleared");
  } catch (error) {
    console.error("❌ Failed to clear existing attachments:", error);
    throw error;
  }

  // Get all messages to attach files to
  let allMessages;
  try {
    console.log("📨 Fetching existing messages...");
    allMessages = await db.select().from(messages);
    console.log(`📊 Found ${allMessages.length} messages`);
  } catch (error) {
    console.error("❌ Failed to fetch messages:", error);
    throw error;
  }

  if (allMessages.length === 0) {
    console.log("⚠️ No messages found. Run messages seed first.");
    return;
  }

  const seedAttachments: NewMessageAttachment[] = [];
  let attachmentCount = 0;

  // File types for categorization
  const fileTypes = [
    { type: "image" as const },
    { type: "pdf" as const },
    { type: "document" as const },
    { type: "spreadsheet" as const },
    { type: "text" as const },
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
        const sampleFile = faker.helpers.arrayElement(
          sampleFiles[fileType.type],
        );
        const filename = faker.helpers.arrayElement(
          sampleFilenames[fileType.type],
        );

        // Upload the sample file to blob storage
        const blobData = await uploadSampleFile(sampleFile.path);

        const attachment: NewMessageAttachment = {
          id: faker.string.uuid(),
          messageId: message.id,
          filename: faker.string.uuid() + sampleFile.path.split(".").pop(),
          originalFilename: filename,
          mimeType: sampleFile.mimeType,
          type: fileType.type,
          size: blobData.size,
          url: blobData.url,
          blobPathname: blobData.blobPathname,
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
  console.log(
    "📁 Attachments uploaded to blob storage and ready for download!",
  );
}

// Export the main function for testing
export { main };

main().catch((err) => {
  console.error("❌ Error seeding message attachments:", err);
  process.exit(1);
});
