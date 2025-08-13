import { config } from "dotenv";
import { uploadToBlob } from "@/services/vercel-blob";
import { readFileSync } from "fs";
import { join } from "path";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function testBlobUpload() {
  console.log("🧪 Testing blob upload functionality...");
  
  // Debug environment variables
  console.log("🔍 Environment check:");
  console.log("  - BLOB_READ_WRITE_TOKEN:", process.env.BLOB_READ_WRITE_TOKEN ? "✅ Set" : "❌ Not set");
  console.log("  - NODE_ENV:", process.env.NODE_ENV || "Not set");
  console.log("  - Current working directory:", process.cwd());

  try {
    // Test with a small image file
    const testFilePath = "public/images/mock/tools/cleaning-brush.jpg";
    const fullPath = join(process.cwd(), testFilePath);

    console.log(`📁 Reading test file: ${testFilePath}`);
    const fileBuffer = readFileSync(fullPath);
    console.log(`📊 File size: ${(fileBuffer.length / 1024).toFixed(2)} KB`);

    // Generate test filename
    const filename = `test-upload/${Date.now()}-test-file.jpg`;
    console.log(`📤 Uploading to blob storage as: ${filename}`);

    // Upload to blob
    const blobResult = await uploadToBlob(filename, fileBuffer);

    console.log("✅ Blob upload successful!");
    console.log(`🔗 URL: ${blobResult.url}`);
    console.log(`📁 Pathname: ${blobResult.pathname}`);

    // Test that we can access the file
    console.log("🧪 Testing file access...");
    const response = await fetch(blobResult.url);
    if (response.ok) {
      console.log("✅ File is accessible via URL");
    } else {
      console.log("❌ File is not accessible via URL");
    }
  } catch (error) {
    console.error("❌ Blob upload test failed:", error);
    process.exit(1);
  }
}

testBlobUpload().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
