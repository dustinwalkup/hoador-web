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
    console.error("Error fetching attachment:", error);
    return Response.json(
      { error: error.message || "Failed to fetch attachment" },
      { status: 500 },
    );
  }

  if (!data) {
    return Response.json({ error: "Attachment not found" }, { status: 404 });
  }

  // Return attachment metadata and download URL
  return Response.json({
    id: data.id,
    filename: data.filename,
    originalFilename: data.originalFilename,
    mimeType: data.mimeType,
    type: data.type,
    size: data.size,
    url: data.url,
    width: data.width,
    height: data.height,
    orderIndex: data.orderIndex,
    createdAt: data.createdAt,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const { attachmentId } = await params;

  const { error } = await tryCatch(
    (async () => {
      return await messagesDAL.deleteMessageAttachment(attachmentId);
    })(),
  );

  if (error) {
    console.error("Error deleting attachment:", error);
    return Response.json(
      { error: error.message || "Failed to delete attachment" },
      { status: 500 },
    );
  }

  return Response.json({ success: true });
}
