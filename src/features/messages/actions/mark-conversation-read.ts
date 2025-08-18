"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { revalidatePath } from "next/cache";
import { messagesDAL } from "@/dal";

export async function markConversationAsReadAction(conversationId: string) {
  const { data, error } = await tryCatch(
    messagesDAL.markConversationAsRead(conversationId),
  );

  if (error) {
    console.error("Failed to mark conversation as read:", error);
    return { success: false, error: error.message };
  }

  // More targeted revalidation - only revalidate the mailbox layout
  revalidatePath("/dashboard/mailbox", "layout");

  return { success: true, data };
}
