"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { messagesDAL } from "@/dal";

export async function startConversationAction(
  recipientId: string,
  listingId: string,
  listingName: string,
  message: string,
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
  // Format message with listing context
  const formattedMessage = `Re: ${listingName} - ${message}`;

  // Pass listingId for context - this enables us to show clickable listing links in the chat
  const { data, error } = await tryCatch(
    messagesDAL.sendMessageToUser(recipientId, formattedMessage, listingId),
  );

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, conversationId: data.conversationId };
}
