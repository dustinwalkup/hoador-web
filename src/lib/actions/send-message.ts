"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { revalidatePath } from "next/cache";
import { messagesDAL } from "@/lib/dal";

export async function sendMessageAction(
  conversationId: string,
  content: string,
) {
  const { data, error } = await tryCatch(
    messagesDAL.sendMessageInConversation(conversationId, content),
  );

  if (error) {
    return { success: false, error: error.message };
  }

  // Revalidate mailbox paths to update the UI for both regular and archived conversations
  revalidatePath("/dashboard/mailbox");
  revalidatePath(`/dashboard/mailbox/${conversationId}`);
  revalidatePath("/dashboard/mailbox/archived");
  revalidatePath(`/dashboard/mailbox/archived/${conversationId}`);

  return { success: true, data };
}
