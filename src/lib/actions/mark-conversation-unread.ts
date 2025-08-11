"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { revalidatePath } from "next/cache";
import { messagesDAL } from "@/lib/dal";

export async function markConversationUnreadAction(conversationId: string) {
  const { data, error } = await tryCatch(
    messagesDAL.markConversationAsUnread(conversationId),
  );

  if (error) {
    console.error("Failed to mark conversation as unread:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/mailbox");
  return { success: true, data };
}
