"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { messagesDAL } from "@/lib/dal";
import { revalidatePath } from "next/cache";

export async function deleteMessageAttachmentAction(
  attachmentId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!attachmentId) {
    return { success: false, error: "Attachment ID is required" };
  }

  const { error } = await tryCatch(
    (async () => {
      return await messagesDAL.deleteMessageAttachment(attachmentId);
    })(),
  );

  if (error) {
    console.error("Failed to delete message attachment:", error);
    return { success: false, error: error.message };
  }

  // Revalidate the conversation page to reflect the deletion
  revalidatePath("/dashboard/mailbox");
  return { success: true };
}
