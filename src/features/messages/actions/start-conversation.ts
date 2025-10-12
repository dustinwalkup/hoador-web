"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { messagesDAL } from "@/dal";

export async function startConversationAction(
  recipientId: string,
  listingId: string,
  listingName: string,
  message: string,
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
  const { data, error } = await tryCatch(
    messagesDAL.sendMessageToUser(recipientId, message, listingId),
  );

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, conversationId: data.conversationId };
}
