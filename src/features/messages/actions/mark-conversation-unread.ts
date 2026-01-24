"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { revalidatePath } from "next/cache";
import { messagesDAL } from "@/dal";
import { requireAuthenticatedUser } from "@/features/auth/utils/session";

export async function markConversationUnreadAction(conversationId: string) {
  const { userId } = await requireAuthenticatedUser();

  const { data, error } = await tryCatch(
    messagesDAL.markConversationAsUnread(conversationId, userId),
  );

  if (error) {
    console.error("Failed to mark conversation as unread:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/mailbox");
  return { success: true, data };
}
