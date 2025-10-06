import { and, eq, desc, asc, or, sql } from "drizzle-orm";
import { tryCatch } from "@walkup/walkup-utils";

import { conversations, messages } from "@/db/schemas/messages.schema";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { BaseDAL } from "./base";
import { UnauthorizedError } from "./errors";
import { ConversationSummary, ConversationDetails } from "./types";

// Types
type ConversationDb = typeof conversations.$inferSelect;
type MessageDb = typeof messages.$inferSelect;

export class MessagesDAL extends BaseDAL {
  async findOrCreateConversation(
    user1Id: string,
    user2Id: string,
  ): Promise<ConversationDb> {
    const { data, error } = await tryCatch(
      (async () => {
        const [smallerId, largerId] = [user1Id, user2Id].sort();

        let conversation = await this.db.query.conversations.findFirst({
          where: and(
            eq(conversations.user1Id, smallerId),
            eq(conversations.user2Id, largerId),
          ),
        });

        if (!conversation) {
          [conversation] = await this.db
            .insert(conversations)
            .values({
              user1Id: smallerId,
              user2Id: largerId,
            })
            .returning();
        }

        return conversation;
      })(),
    );

    if (error) {
      this.handleError(error, "findOrCreateConversation");
    }

    return data;
  }

  async sendMessage(
    senderId: string,
    recipientId: string,
    content: string,
    rentalId?: string,
  ): Promise<MessageDb[]> {
    const { data, error } = await tryCatch(
      (async () => {
        const conversation = await this.findOrCreateConversation(
          senderId,
          recipientId,
        );

        return await this.db
          .insert(messages)
          .values({
            conversationId: conversation.id,
            senderId,
            content,
            rentalId,
          })
          .returning();
      })(),
    );

    if (error) {
      this.handleError(error, "sendMessage");
    }

    return data;
  }

  async sendMessageToUser(
    recipientId: string,
    content: string,
    listingId?: string,
  ): Promise<{ conversationId: string; messageId: string }> {
    const { data, error } = await tryCatch(
      (async () => {
        const currentUserId = await getCurrentUserId();
        if (!currentUserId) {
          throw new UnauthorizedError("User not authenticated");
        }

        const conversation = await this.findOrCreateConversation(
          currentUserId,
          recipientId,
        );

        const [message] = await this.db
          .insert(messages)
          .values({
            conversationId: conversation.id,
            senderId: currentUserId,
            content,
            listingId, // Store listing reference for context
          })
          .returning();

        // Update conversation's lastMessageAt
        await this.db
          .update(conversations)
          .set({ lastMessageAt: new Date() })
          .where(eq(conversations.id, conversation.id));

        return {
          conversationId: conversation.id,
          messageId: message.id,
        };
      })(),
    );

    if (error) {
      this.handleError(error, "sendMessageToUser");
    }

    return data;
  }

  async getUserConversations(
    archived?: boolean,
  ): Promise<ConversationSummary[]> {
    return this.getUserConversationsPaginated(archived, 0, 1000); // Default to get all for backward compatibility
  }

  async getUserConversationsPaginated(
    archived?: boolean,
    offset: number = 0,
    limit: number = 20,
  ): Promise<ConversationSummary[]> {
    const { data, error } = await tryCatch(
      (async () => {
        const currentUserId = await getCurrentUserId();
        if (!currentUserId) {
          throw new UnauthorizedError("User not authenticated");
        }

        const userConversations = await this.db.query.conversations.findMany({
          where: and(
            or(
              eq(conversations.user1Id, currentUserId),
              eq(conversations.user2Id, currentUserId),
            ),
            // Filter by archived status if specified
            archived !== undefined
              ? or(
                  and(
                    eq(conversations.user1Id, currentUserId),
                    eq(conversations.user1Archived, archived),
                  ),
                  and(
                    eq(conversations.user2Id, currentUserId),
                    eq(conversations.user2Archived, archived),
                  ),
                )
              : undefined,
          ),
          with: {
            user1: {
              columns: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            user2: {
              columns: {
                id: true,
                lastName: true,
                firstName: true,
              },
            },
            messages: {
              orderBy: [desc(messages.createdAt)],
              limit: 1,
              with: {
                sender: {
                  columns: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
          orderBy: [desc(conversations.lastMessageAt)],
          offset,
          limit,
        });

        return userConversations.map((conversation) => {
          const otherUser =
            conversation.user1.id === currentUserId
              ? conversation.user2
              : conversation.user1;

          const lastMessage = conversation.messages[0];
          const isUnread =
            conversation.user1.id === currentUserId
              ? conversation.user1LastReadAt === null ||
                (lastMessage &&
                  conversation.user1LastReadAt < lastMessage.createdAt &&
                  lastMessage.senderId !== currentUserId) // Don't mark as unread if we sent the last message
              : conversation.user2LastReadAt === null ||
                (lastMessage &&
                  conversation.user2LastReadAt < lastMessage.createdAt &&
                  lastMessage.senderId !== currentUserId); // Don't mark as unread if we sent the last message

          return {
            id: conversation.id,
            otherUser: {
              id: otherUser.id,
              name: `${otherUser.firstName} ${otherUser.lastName}`,
              avatar: null, // Avatar not available in current schema
              initials: `${otherUser.firstName?.[0] || ""}${otherUser.lastName?.[0] || ""}`,
            },
            lastMessage: lastMessage
              ? {
                  content: lastMessage.content,
                  time: lastMessage.createdAt,
                  senderId: lastMessage.senderId,
                }
              : null,
            unread: isUnread,
            lastMessageAt: conversation.lastMessageAt,
            archived:
              conversation.user1.id === currentUserId
                ? conversation.user1Archived
                : conversation.user2Archived,
          };
        });
      })(),
    );

    if (error) {
      this.handleError(error, "getUserConversations");
    }

    return data;
  }

  async getConversationDetails(
    conversationId: string,
  ): Promise<ConversationDetails> {
    const { data, error } = await tryCatch(
      (async () => {
        console.log("Getting conversation details for:", conversationId);
        const currentUserId = await getCurrentUserId();
        console.log("Current user ID:", currentUserId);
        if (!currentUserId) {
          throw new UnauthorizedError("User not authenticated");
        }

        const conversation = await this.db.query.conversations.findFirst({
          where: and(
            eq(conversations.id, conversationId),
            or(
              eq(conversations.user1Id, currentUserId),
              eq(conversations.user2Id, currentUserId),
            ),
          ),
          with: {
            user1: {
              columns: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            user2: {
              columns: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            messages: {
              orderBy: [asc(messages.createdAt)],
              with: {
                sender: {
                  columns: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
                listing: {
                  columns: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });

        if (!conversation) {
          throw new Error("Conversation not found");
        }

        const otherUser =
          conversation.user1.id === currentUserId
            ? conversation.user2
            : conversation.user1;

        const lastMessage =
          conversation.messages[conversation.messages.length - 1];
        const isUnread =
          conversation.user1.id === currentUserId
            ? conversation.user1LastReadAt === null ||
              (lastMessage &&
                conversation.user1LastReadAt < lastMessage.createdAt &&
                lastMessage.senderId !== currentUserId)
            : conversation.user2LastReadAt === null ||
              (lastMessage &&
                conversation.user2LastReadAt < lastMessage.createdAt &&
                lastMessage.senderId !== currentUserId);

        return {
          id: conversation.id,
          otherUser: {
            id: otherUser.id,
            name: `${otherUser.firstName} ${otherUser.lastName}`,
            avatar: null, // Avatar not available in current schema
            initials: `${otherUser.firstName?.[0] || ""}${otherUser.lastName?.[0] || ""}`,
          },
          messages: conversation.messages.map((message) => ({
            id: message.id,
            content: message.content,
            time: message.createdAt,
            sender: (message.senderId === currentUserId ? "me" : "them") as
              | "me"
              | "them",
            senderName: `${message.sender.firstName} ${message.sender.lastName}`,
            listingId: message.listing?.id ?? null,
            listingName: message.listing?.name ?? null,
          })),
          unread: isUnread,
          archived:
            conversation.user1.id === currentUserId
              ? conversation.user1Archived
              : conversation.user2Archived,
        };
      })(),
    );

    if (error) {
      console.error("Error in getConversationDetails:", error);
      this.handleError(error, "getConversationDetails");
    }

    return data;
  }

  async markConversationAsRead(
    conversationId: string,
  ): Promise<ConversationDb[]> {
    const { data, error } = await tryCatch(
      (async () => {
        const currentUserId = await getCurrentUserId();
        if (!currentUserId) {
          throw new UnauthorizedError("User not authenticated");
        }

        const conversation = await this.db.query.conversations.findFirst({
          where: eq(conversations.id, conversationId),
        });

        if (!conversation) {
          throw new Error("Conversation not found");
        }

        const updateData: { user1LastReadAt?: Date; user2LastReadAt?: Date } =
          {};
        if (conversation.user1Id === currentUserId) {
          updateData.user1LastReadAt = new Date();
        } else if (conversation.user2Id === currentUserId) {
          updateData.user2LastReadAt = new Date();
        }

        return await this.db
          .update(conversations)
          .set(updateData)
          .where(eq(conversations.id, conversationId))
          .returning();
      })(),
    );

    if (error) {
      this.handleError(error, "markConversationAsRead");
    }

    return data;
  }

  async markConversationAsUnread(
    conversationId: string,
  ): Promise<ConversationDb[]> {
    const { data, error } = await tryCatch(
      (async () => {
        const currentUserId = await getCurrentUserId();
        if (!currentUserId) {
          throw new UnauthorizedError("User not authenticated");
        }

        const conversation = await this.db.query.conversations.findFirst({
          where: eq(conversations.id, conversationId),
        });

        if (!conversation) {
          throw new Error("Conversation not found");
        }

        // Use sql function to explicitly set NULL values
        const updateData: {
          user1LastReadAt?: ReturnType<typeof sql>;
          user2LastReadAt?: ReturnType<typeof sql>;
        } = {};

        if (conversation.user1Id === currentUserId) {
          updateData.user1LastReadAt = sql`NULL`;
        } else if (conversation.user2Id === currentUserId) {
          updateData.user2LastReadAt = sql`NULL`;
        }

        // Ensure we have fields to update
        if (Object.keys(updateData).length === 0) {
          throw new Error("No fields to update");
        }

        return await this.db
          .update(conversations)
          .set(updateData)
          .where(eq(conversations.id, conversationId))
          .returning();
      })(),
    );

    if (error) {
      this.handleError(error, "markConversationAsUnread");
    }

    return data;
  }

  async sendMessageInConversation(
    conversationId: string,
    content: string,
    rentalId?: string,
  ): Promise<MessageDb> {
    const { data, error } = await tryCatch(
      (async () => {
        const currentUserId = await getCurrentUserId();
        if (!currentUserId) {
          throw new UnauthorizedError("User not authenticated");
        }

        // Verify user is part of conversation
        const conversation = await this.db.query.conversations.findFirst({
          where: and(
            eq(conversations.id, conversationId),
            or(
              eq(conversations.user1Id, currentUserId),
              eq(conversations.user2Id, currentUserId),
            ),
          ),
        });

        if (!conversation) {
          throw new Error("Conversation not found or access denied");
        }

        const [message] = await this.db
          .insert(messages)
          .values({
            conversationId,
            senderId: currentUserId,
            content,
            rentalId,
          })
          .returning();

        // Update conversation's lastMessageAt
        await this.db
          .update(conversations)
          .set({ lastMessageAt: new Date() })
          .where(eq(conversations.id, conversationId));

        return message;
      })(),
    );

    if (error) {
      this.handleError(error, "sendMessageInConversation");
    }

    return data;
  }

  async archiveConversation(
    conversationId: string,
    archived: boolean = true,
  ): Promise<ConversationDb[]> {
    const { data, error } = await tryCatch(
      (async () => {
        const currentUserId = await getCurrentUserId();
        if (!currentUserId) {
          throw new UnauthorizedError("User not authenticated");
        }

        const conversation = await this.db.query.conversations.findFirst({
          where: eq(conversations.id, conversationId),
        });

        if (!conversation) {
          throw new Error("Conversation not found");
        }

        const updateData: { user1Archived?: boolean; user2Archived?: boolean } =
          {};
        if (conversation.user1Id === currentUserId) {
          updateData.user1Archived = archived;
        } else if (conversation.user2Id === currentUserId) {
          updateData.user2Archived = archived;
        }

        return await this.db
          .update(conversations)
          .set(updateData)
          .where(eq(conversations.id, conversationId))
          .returning();
      })(),
    );

    if (error) {
      this.handleError(error, "archiveConversation");
    }

    return data;
  }

  async unarchiveConversation(
    conversationId: string,
  ): Promise<ConversationDb[]> {
    return this.archiveConversation(conversationId, false);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const { error } = await tryCatch(
      (async () => {
        const currentUserId = await getCurrentUserId();
        if (!currentUserId) {
          throw new UnauthorizedError("User not authenticated");
        }

        // Verify user is part of conversation
        const conversation = await this.db.query.conversations.findFirst({
          where: and(
            eq(conversations.id, conversationId),
            or(
              eq(conversations.user1Id, currentUserId),
              eq(conversations.user2Id, currentUserId),
            ),
          ),
        });

        if (!conversation) {
          throw new Error("Conversation not found or access denied");
        }

        // Delete the conversation (messages will be cascaded)
        await this.db
          .delete(conversations)
          .where(eq(conversations.id, conversationId));
      })(),
    );

    if (error) {
      this.handleError(error, "deleteConversation");
    }
  }
}
