"use client";

import { useMemo, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { usePrefetchConversation } from "@/features/messages/hooks/use-conversations";
import { useMarkConversationRead } from "@/features/messages/hooks/use-message-mutations";
import { ConversationSummary } from "@/dal/types";
import { sanitizeForDisplay } from "@/lib/utils/sanitize-client";

interface ConversationsListProps {
  conversationsData?: {
    pages: Array<ConversationSummary[]>;
  };
  searchQuery: string;
  selectedConversationId: string | null;
  isLoading: boolean;
  // End of Selection
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onConversationClick: (conversationId: string) => void;
  onLoadMore: () => void;
}

export function ConversationsList({
  conversationsData,
  searchQuery,
  selectedConversationId,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  onConversationClick,
  onLoadMore,
}: ConversationsListProps) {
  const prefetchConversation = usePrefetchConversation();
  const queryClient = useQueryClient();
  const markConversationReadMutation = useMarkConversationRead();

  // Flatten conversations from all pages
  const allConversations = useMemo(() => {
    if (!conversationsData?.pages) return [];
    return conversationsData.pages.flatMap(
      (page: ConversationSummary[]) => page,
    );
  }, [conversationsData]);

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return allConversations;
    return allConversations.filter(
      (conv: ConversationSummary) =>
        conv.otherUser.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.lastMessage?.content
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
    );
  }, [allConversations, searchQuery]);

  // Infinite scroll
  const loadMoreRef = useInfiniteScroll({
    onLoadMore: onLoadMore,
    hasNextPage,
    isFetchingNextPage,
  });

  const formatDate = useCallback((date: Date | null) => {
    if (!date) return "";

    // Ensure we have a valid Date object
    let dateObj: Date;
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === "string") {
      dateObj = new Date(date);
    } else {
      return ""; // Return empty for invalid dates
    }

    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      return "";
    }

    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - dateObj.getTime()) / (1000 * 60),
    );

    if (diffInMinutes < 1) return "now";
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  }, []);

  // Helper function to update conversation cache
  const updateConversationCache = useCallback(
    (conversationId: string, unread: boolean) => {
      // Update both archived and non-archived conversation caches
      [false, true].forEach((archived) => {
        queryClient.setQueryData(
          ["conversations", archived],
          (oldData: { pages: ConversationSummary[][] } | undefined) => {
            if (!oldData?.pages) return oldData;

            return {
              ...oldData,
              pages: oldData.pages.map((page: ConversationSummary[]) =>
                page.map((conv: ConversationSummary) =>
                  conv.id === conversationId ? { ...conv, unread } : conv,
                ),
              ),
            };
          },
        );
      });
    },
    [queryClient],
  );

  const handleConversationClick = useCallback(
    async (conversationId: string) => {
      // Find the conversation to check if it's unread
      const conversation = allConversations.find(
        (conv) => conv.id === conversationId,
      );
      const wasUnread = conversation?.unread;

      // Immediate optimistic update
      onConversationClick(conversationId);

      // If the conversation was unread, mark as read in background
      if (wasUnread) {
        markConversationReadMutation.mutate(
          { conversationId },
          {
            onError: () => {
              // Revert optimistic update on error
              updateConversationCache(conversationId, true);
            },
          },
        );
      }
    },
    [
      onConversationClick,
      allConversations,
      markConversationReadMutation,
      updateConversationCache,
    ],
  );

  const handleConversationHover = useCallback(
    (conversationId: string) => {
      // Prefetch on hover for faster loading
      prefetchConversation(conversationId);
    },
    [prefetchConversation],
  );

  // Memoize conversation items to prevent unnecessary re-renders
  const conversationItems = useMemo(() => {
    return filteredConversations.map((conversation: ConversationSummary) => (
      <div
        key={conversation.id}
        role="button"
        tabIndex={0}
        aria-label={`Conversation with ${conversation.otherUser.name}`}
        aria-current={
          selectedConversationId === conversation.id ? "true" : undefined
        }
        onClick={() => handleConversationClick(conversation.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleConversationClick(conversation.id);
          }
        }}
        onMouseEnter={() => handleConversationHover(conversation.id)}
        className={`relative flex cursor-pointer items-center border-l-4 p-4 transition-colors hover:bg-gray-50 ${
          selectedConversationId === conversation.id
            ? "border-blue-500 bg-blue-50"
            : "border-transparent"
        } ${conversation.unread ? "bg-blue-50" : ""}`}
      >
        {/* Unread indicator dot */}
        {conversation.unread && (
          <div className="bg-primary absolute top-1/2 left-0.5 h-2 w-2 -translate-y-1/2 rounded-full" />
        )}
        <Avatar className="mr-3 h-10 w-10">
          <AvatarFallback className="bg-gray-200 text-sm font-medium text-gray-700">
            {conversation.otherUser.initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="truncate text-sm font-medium text-gray-900">
              {sanitizeForDisplay(conversation.otherUser.name)}
            </h3>
            <span className="text-xs text-gray-500">
              {formatDate(conversation.lastMessageAt)}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-gray-600">
            {conversation.lastMessage?.content
              ? sanitizeForDisplay(conversation.lastMessage.content)
              : "No messages yet"}
          </p>
        </div>
      </div>
    ));
  }, [
    filteredConversations,
    selectedConversationId,
    handleConversationClick,
    handleConversationHover,
    formatDate,
  ]);

  return (
    <div className="scrollbar-hover-reveal flex-1 overflow-y-auto">
      {conversationItems}

      {/* Infinite scroll trigger */}
      {hasNextPage && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {isFetchingNextPage && (
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          )}
        </div>
      )}

      {isLoading && filteredConversations.length === 0 && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
}
