import { NextRequest } from "next/server";
import { messagesDAL } from "@/lib/dal";
import { tryCatch } from "@walkup/walkup-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const { attachmentId } = await params;

  const { data, error } = await tryCatch(
    (async () => {
      return await messagesDAL.getMessageAttachment(attachmentId);
    })(),
  );

  if (error) {
    console.error("Error fetching attachment for download:", error);
    return Response.json(
      { error: error.message || "Failed to fetch attachment" },
      { status: 500 },
    );
  }

  if (!data) {
    return Response.json({ error: "Attachment not found" }, { status: 404 });
  }

  // Fetch the file from blob storage
  const { data: fileData, error: fetchError } = await tryCatch(
    (async () => {
      const response = await fetch(data.url);

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      const fileBuffer = await response.arrayBuffer();
      const headers = new Headers();

      // Set appropriate headers for file download
      headers.set("Content-Type", data.mimeType);
      headers.set(
        "Content-Disposition",
        `attachment; filename="${data.originalFilename}"`,
      );
      headers.set("Content-Length", data.size.toString());

      // Security headers
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("X-Frame-Options", "DENY");
      headers.set("X-XSS-Protection", "1; mode=block");

      // Cache control - don't cache sensitive files
      headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      headers.set("Pragma", "no-cache");
      headers.set("Expires", "0");

      return new Response(fileBuffer, {
        status: 200,
        headers,
      });
    })(),
  );

  if (fetchError) {
    console.error("Error fetching file from blob storage:", fetchError);
    return Response.json({ error: "Failed to download file" }, { status: 500 });
  }

  return fileData;
}
