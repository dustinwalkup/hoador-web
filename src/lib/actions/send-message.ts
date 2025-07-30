"use server";

import { tryCatch } from "@walkup/walkup-utils";
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

  return { success: true, data };
}
