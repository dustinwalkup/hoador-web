"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { messagesDAL } from "@/dal";
import { requireAuthenticatedUser } from "@/features/auth/utils/session";

export async function sendMessageAction(
  conversationId: string,
  content: string,
) {
  const { userId } = await requireAuthenticatedUser();

  const { data, error } = await tryCatch(
    messagesDAL.sendMessageInConversation(conversationId, userId, content),
  );

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}
