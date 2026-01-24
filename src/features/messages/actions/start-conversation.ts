"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { messagesDAL } from "@/dal";
import { requireAuthenticatedUser } from "@/features/auth/utils/session";

export async function startConversationAction(
  recipientId: string,
  listingId: string,
  listingName: string,
  message: string,
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
  const { userId } = await requireAuthenticatedUser();

  const { data, error } = await tryCatch(
    messagesDAL.sendMessageToUser(userId, recipientId, message, listingId),
  );

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, conversationId: data.conversationId };
}
