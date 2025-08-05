import { and, eq, desc, asc, or } from "drizzle-orm";
import { tryCatch } from "@walkup/walkup-utils";

import { conversations, messages } from "@/db/schemas/messages.schema";
import { getCurrentUserId } from "@/lib/auth/auth.utils";
import { BaseDAL } from "./base";
import { UnauthorizedError } from "./errors";

// Types
type ConversationDb = typeof conversations.$inferSelect;
type MessageDb = typeof messages.$inferSelect;

export interface ConversationSummary {
  id: string;
  otherUser: {
    id: string;
    name: string;
    avatar: string | null;
    initials: string;
  };
  lastMessage: {
    content: string;
    time: Date;
    senderId: string;
  } | null;
  unread: boolean;
  lastMessageAt: Date | null;
  archived: boolean;
}

export interface ConversationDetails {
  id: string;
  otherUser: {
    id: string;
    name: string;
    avatar: string | null;
    initials: string;
  };
  messages: Array<{
    id: string;
    content: string;
    time: Date;
    sender: "me" | "them";
    senderName: string;
  }>;
}

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

  async getUserConversations(
    archived?: boolean,
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
                firstName: true,
                lastName: true,
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
                  conversation.user1LastReadAt < lastMessage.createdAt)
              : conversation.user2LastReadAt === null ||
                (lastMessage &&
                  conversation.user2LastReadAt < lastMessage.createdAt);

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
        const currentUserId = await getCurrentUserId();
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
          })),
        };
      })(),
    );

    if (error) {
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
}
