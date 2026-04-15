import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import { toast } from "sonner";
import type { ConversationDetails, ConversationSummary } from "@/dal/types";

interface StartConversationData {
  recipientId: string;
  /** Tool rental listing id (`listings.id`). */
  listingId?: string;
  /** Service listing id (`service_listings.id`). */
  serviceListingId?: string;
  listingName: string;
  message: string;
}

interface SendMessageData {
  content: string;
}

interface StartConversationResponse {
  success: boolean;
  conversationId?: string;
  error?: string;
}

interface SendMessageResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Hook for starting a new conversation
 */
export function useStartConversation() {
  const queryClient = useQueryClient();

  return useCreateMutation<StartConversationResponse, StartConversationData>({
    mutationFn: async (data: StartConversationData) => {
      const response = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start conversation");
      }

      return response.json();
    },
    successMessage: "Message sent successfully",
    invalidateQueryKeys: [
      ["conversations", false],
      ["messages", "unread-count"],
      ["dashboard", "badges"],
    ],
    onSuccess: (data) => {
      // Invalidate conversation details if conversationId is returned
      if (data.conversationId) {
        queryClient.invalidateQueries({
          queryKey: ["conversation-details", data.conversationId],
        });
      }
    },
  });
}

/**
 * Hook for sending a message in an existing conversation
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation<
    SendMessageResponse,
    Error,
    SendMessageData & { conversationId: string },
    { previousData?: ConversationDetails | undefined }
  >({
    mutationFn: async ({ conversationId, content }) => {
      const response = await fetch(
        `/api/messages/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send message");
      }

      return response.json();
    },
    // BEFORE mutation: Add optimistic message
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["conversation-details", variables.conversationId],
      });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<ConversationDetails>([
        "conversation-details",
        variables.conversationId,
      ]);

      // Optimistically add message
      if (previousData) {
        const optimisticMessage = {
          id: `temp-${Date.now()}`,
          content: variables.content,
          time: new Date(),
          sender: "me" as const,
          senderName: "You",
          listingId: null,
          listingName: null,
          serviceListingId: null,
          serviceListingName: null,
        };

        queryClient.setQueryData<ConversationDetails>(
          ["conversation-details", variables.conversationId],
          {
            ...previousData,
            messages: [...previousData.messages, optimisticMessage],
          },
        );
      }

      // Return context for rollback
      return { previousData };
    },
    // ON ERROR: Rollback to previous state
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          ["conversation-details", variables.conversationId],
          context.previousData,
        );
      }
      toast.error(err.message || "Failed to send message", {
        duration: 5000,
      });
    },
    // ON SUCCESS: Replace temp message with real one
    onSuccess: (data, variables) => {
      if (!data.data) return;

      const newMessage = data.data as {
        id: string;
        content: string;
        createdAt: Date;
        senderId: string;
      };

      queryClient.setQueryData<ConversationDetails>(
        ["conversation-details", variables.conversationId],
        (oldData) => {
          if (!oldData) return oldData;

          // Replace temp message with real one
          const updatedMessages = oldData.messages.map((msg) =>
            msg.id.startsWith("temp-")
              ? {
                  id: newMessage.id,
                  content: newMessage.content,
                  time: newMessage.createdAt,
                  sender: "me" as const,
                  senderName: "You",
                  listingId: null,
                  listingName: null,
                  serviceListingId: null,
                  serviceListingName: null,
                }
              : msg,
          );

          return { ...oldData, messages: updatedMessages, unread: false };
        },
      );

      // Update conversations list with latest message
      queryClient.setQueryData<{ pages: ConversationSummary[][] }>(
        ["conversations", false],
        (oldData) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) =>
              page.map((conv) =>
                conv.id === variables.conversationId
                  ? {
                      ...conv,
                      lastMessage: {
                        content: newMessage.content,
                        time: newMessage.createdAt,
                        senderId: newMessage.senderId,
                      },
                      lastMessageAt: newMessage.createdAt,
                      unread: false,
                    }
                  : conv,
              ),
            ),
          };
        },
      );

      // Invalidate queries for background refresh
      queryClient.invalidateQueries({
        queryKey: ["conversations", false],
      });
      queryClient.invalidateQueries({
        queryKey: ["messages", "unread-count"],
      });
      queryClient.invalidateQueries({
        queryKey: ["dashboard", "badges"],
      });
    },
  });
}

/**
 * Hook for archiving a conversation
 */
export function useArchiveConversation() {
  const queryClient = useQueryClient();

  return useCreateMutation<
    { success: boolean; data?: unknown },
    { conversationId: string }
  >({
    mutationFn: async ({ conversationId }) => {
      const response = await fetch(
        `/api/messages/conversations/${conversationId}/archive`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to archive conversation");
      }

      return response.json();
    },
    successMessage: "Conversation archived",
    invalidateQueryKeys: [
      ["conversations", false],
      ["conversations", true],
      ["conversation-details"],
    ],
    onSuccess: (data, variables) => {
      // Optimistically update conversation details
      queryClient.setQueryData<ConversationDetails>(
        ["conversation-details", variables.conversationId],
        (oldData) => {
          if (!oldData) return oldData;
          return { ...oldData, archived: true };
        },
      );

      // Optimistically update conversations list
      queryClient.setQueryData<{ pages: ConversationSummary[][] }>(
        ["conversations", false],
        (oldData) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) =>
              page.filter((conv) => conv.id !== variables.conversationId),
            ),
          };
        },
      );
    },
  });
}

/**
 * Hook for unarchiving a conversation
 */
export function useUnarchiveConversation() {
  const queryClient = useQueryClient();

  return useCreateMutation<
    { success: boolean; data?: unknown },
    { conversationId: string }
  >({
    mutationFn: async ({ conversationId }) => {
      const response = await fetch(
        `/api/messages/conversations/${conversationId}/unarchive`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unarchive conversation");
      }

      return response.json();
    },
    successMessage: "Conversation unarchived",
    invalidateQueryKeys: [
      ["conversations", false],
      ["conversations", true],
      ["conversation-details"],
    ],
    onSuccess: (data, variables) => {
      // Optimistically update conversation details
      queryClient.setQueryData<ConversationDetails>(
        ["conversation-details", variables.conversationId],
        (oldData) => {
          if (!oldData) return oldData;
          return { ...oldData, archived: false };
        },
      );
    },
  });
}

/**
 * Hook for marking a conversation as read
 */
export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useCreateMutation<
    { success: boolean; data?: unknown },
    { conversationId: string }
  >({
    mutationFn: async ({ conversationId }) => {
      const response = await fetch(
        `/api/messages/conversations/${conversationId}/read`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to mark conversation as read");
      }

      return response.json();
    },
    invalidateQueryKeys: [
      ["conversation-details"],
      ["conversations", false],
      ["messages", "unread-count"],
      ["dashboard", "badges"],
    ],
    onSuccess: (data, variables) => {
      // Optimistically update conversation details
      queryClient.setQueryData<ConversationDetails>(
        ["conversation-details", variables.conversationId],
        (oldData) => {
          if (!oldData) return oldData;
          return { ...oldData, unread: false };
        },
      );

      // Optimistically update conversations list
      queryClient.setQueryData<{ pages: ConversationSummary[][] }>(
        ["conversations", false],
        (oldData) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) =>
              page.map((conv) =>
                conv.id === variables.conversationId
                  ? { ...conv, unread: false }
                  : conv,
              ),
            ),
          };
        },
      );
    },
  });
}

/**
 * Hook for marking a conversation as unread
 */
export function useMarkConversationUnread() {
  const queryClient = useQueryClient();

  return useCreateMutation<
    { success: boolean; data?: unknown },
    { conversationId: string }
  >({
    mutationFn: async ({ conversationId }) => {
      const response = await fetch(
        `/api/messages/conversations/${conversationId}/unread`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to mark conversation as unread");
      }

      return response.json();
    },
    successMessage: "Marked as unread",
    invalidateQueryKeys: [
      ["conversation-details"],
      ["conversations", false],
      ["messages", "unread-count"],
      ["dashboard", "badges"],
    ],
    onSuccess: (data, variables) => {
      // Optimistically update conversation details
      queryClient.setQueryData<ConversationDetails>(
        ["conversation-details", variables.conversationId],
        (oldData) => {
          if (!oldData) return oldData;
          return { ...oldData, unread: true };
        },
      );

      // Optimistically update conversations list
      queryClient.setQueryData<{ pages: ConversationSummary[][] }>(
        ["conversations", false],
        (oldData) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) =>
              page.map((conv) =>
                conv.id === variables.conversationId
                  ? { ...conv, unread: true }
                  : conv,
              ),
            ),
          };
        },
      );
    },
  });
}

/**
 * Hook for deleting a conversation
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useCreateMutation<{ success: boolean }, { conversationId: string }>({
    mutationFn: async ({ conversationId }) => {
      const response = await fetch(
        `/api/messages/conversations/${conversationId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete conversation");
      }

      return response.json();
    },
    successMessage: "Conversation deleted",
    invalidateQueryKeys: [
      ["conversations", false],
      ["conversations", true],
      ["conversation-details"],
    ],
    onSuccess: (data, variables) => {
      // Remove conversation from cache
      queryClient.removeQueries({
        queryKey: ["conversation-details", variables.conversationId],
      });

      // Optimistically remove from conversations list
      queryClient.setQueryData<{ pages: ConversationSummary[][] }>(
        ["conversations", false],
        (oldData) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) =>
              page.filter((conv) => conv.id !== variables.conversationId),
            ),
          };
        },
      );

      queryClient.setQueryData<{ pages: ConversationSummary[][] }>(
        ["conversations", true],
        (oldData) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) =>
              page.filter((conv) => conv.id !== variables.conversationId),
            ),
          };
        },
      );
    },
  });
}
