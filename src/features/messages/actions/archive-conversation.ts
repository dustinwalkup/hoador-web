"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { revalidatePath } from "next/cache";
import { messagesDAL } from "@/dal";

export async function archiveConversationAction(conversationId: string) {
  const { data, error } = await tryCatch(
    messagesDAL.archiveConversation(conversationId),
  );

  if (error) {
    console.error("Failed to archive conversation:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/mailbox");
  return { success: true, data };
}
