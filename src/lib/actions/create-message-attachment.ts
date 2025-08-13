"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { messagesDAL } from "@/lib/dal";
import { revalidatePath } from "next/cache";

export interface CreateMessageAttachmentData {
  messageId: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  type: "image" | "pdf" | "document" | "spreadsheet" | "text" | "other";
  size: number;
  url: string;
  blobPathname: string;
  width?: number;
  height?: number;
  orderIndex?: number;
}

export async function createMessageAttachmentAction(
  prevState: unknown,
  formData: FormData,
): Promise<{ success: boolean; attachmentId?: string; error?: string }> {
  const messageId = formData.get("messageId") as string;
  const filename = formData.get("filename") as string;
  const originalFilename = formData.get("originalFilename") as string;
  const mimeType = formData.get("mimeType") as string;
  const type = formData.get("type") as
    | "image"
    | "pdf"
    | "document"
    | "spreadsheet"
    | "text"
    | "other";
  const size = parseInt(formData.get("size") as string);
  const url = formData.get("url") as string;
  const blobPathname = formData.get("blobPathname") as string;
  const width = formData.get("width")
    ? parseInt(formData.get("width") as string)
    : undefined;
  const height = formData.get("height")
    ? parseInt(formData.get("height") as string)
    : undefined;
  const orderIndex = formData.get("orderIndex")
    ? parseInt(formData.get("orderIndex") as string)
    : 0;

  if (
    !messageId ||
    !filename ||
    !originalFilename ||
    !mimeType ||
    !type ||
    !size ||
    !url ||
    !blobPathname
  ) {
    return { success: false, error: "Missing required fields" };
  }

  const { data, error } = await tryCatch(
    (async () => {
      return await messagesDAL.createMessageAttachment(messageId, {
        filename,
        originalFilename,
        mimeType,
        type,
        size,
        url,
        blobPathname,
        width,
        height,
        orderIndex,
      });
    })(),
  );

  if (error) {
    console.error("Failed to create message attachment:", error);
    return { success: false, error: error.message };
  }

  // Revalidate the conversation page to show the new attachment
  revalidatePath("/dashboard/mailbox");
  return { success: true, attachmentId: data.id };
}
