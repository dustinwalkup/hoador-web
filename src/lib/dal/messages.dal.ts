import { and, eq } from "drizzle-orm";

import { db } from "@/db/db";
import { conversations, messages } from "@/db/schemas/messages.schema";

export async function findOrCreateConversation(
  user1Id: string,
  user2Id: string,
) {
  const [smallerId, largerId] = [user1Id, user2Id].sort();

  let conversation = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.user1Id, smallerId),
      eq(conversations.user2Id, largerId),
    ),
  });

  if (!conversation) {
    [conversation] = await db
      .insert(conversations)
      .values({
        user1Id: smallerId,
        user2Id: largerId,
      })
      .returning();
  }

  return conversation;
}

export async function sendMessage(
  senderId: string,
  recipientId: string,
  content: string,
  rentalId?: string,
) {
  const conversation = await findOrCreateConversation(senderId, recipientId);

  return db
    .insert(messages)
    .values({
      conversationId: conversation.id,
      senderId,
      content,
      rentalId,
    })
    .returning();
}
