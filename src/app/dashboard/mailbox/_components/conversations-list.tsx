"use client";

import { useMemo, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { useInfiniteScroll } from "@/lib/hooks/use-infinite-scroll";
import { usePrefetchConversation } from "@/lib/hooks/use-conversations";
import { markConversationAsReadAction } from "@/lib/actions/mark-conversation-read";
import { useTransition } from "react";
import { ConversationSummary } from "@/lib/dal/messages.dal";

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
  const [, startTransition] = useTransition();
  const prefetchConversation = usePrefetchConversation();

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
    return formatDistanceToNow(date, { addSuffix: true });
  }, []);

  const handleConversationClick = useCallback(
    async (conversationId: string) => {
      // Immediate optimistic update
      onConversationClick(conversationId);

      // Mark as read in background
      startTransition(async () => {
        try {
          await markConversationAsReadAction(conversationId);
        } catch (error) {
          console.error("Failed to mark as read:", error);
        }
      });
    },
    [onConversationClick, startTransition],
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
        onClick={() => handleConversationClick(conversation.id)}
        onMouseEnter={() => handleConversationHover(conversation.id)}
        className={`flex cursor-pointer items-center border-l-4 p-4 transition-colors hover:bg-gray-50 ${
          selectedConversationId === conversation.id
            ? "border-blue-500 bg-blue-50"
            : "border-transparent"
        } ${conversation.unread ? "bg-blue-50" : ""}`}
      >
        <Avatar className="mr-3 h-10 w-10">
          <AvatarFallback className="bg-gray-200 text-sm font-medium text-gray-700">
            {conversation.otherUser.initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="truncate text-sm font-medium text-gray-900">
              {conversation.otherUser.name}
            </h3>
            <span className="text-xs text-gray-500">
              {formatDate(conversation.lastMessageAt)}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-gray-600">
            {conversation.lastMessage?.content || "No messages yet"}
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
    <div className="flex-1 overflow-y-auto">
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
