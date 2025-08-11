"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { revalidatePath } from "next/cache";
import { messagesDAL } from "@/lib/dal";

export async function unarchiveConversationAction(conversationId: string) {
  const { data, error } = await tryCatch(
    messagesDAL.unarchiveConversation(conversationId),
  );

  if (error) {
    console.error("Failed to unarchive conversation:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/mailbox");
  return { success: true, data };
}
