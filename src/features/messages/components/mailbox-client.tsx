"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";

import { MobileHeader } from "./mobile-header";
import { MailboxSearch } from "./mailbox-search";
import { MailboxTabs } from "./mailbox-tabs";
import { ConversationsList } from "./conversations-list";
import { ChatArea } from "./chat-area";
import { ConversationSummary } from "@/dal/types";

// Compute initial tab based on conversation parameter
function getInitialTab(
  conversationParam: string | null,
  conversations: ConversationSummary[],
): "inbox" | "archived" {
  if (!conversationParam) return "inbox";
  const conversation = conversations.find(
    (conv) => conv.id === conversationParam,
  );
  return conversation?.archived ? "archived" : "inbox";
}

export function MailboxClient({
  conversations,
}: {
  conversations: ConversationSummary[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationParam = searchParams.get("conversation");

  // Compute initial values based on URL parameter
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(() => {
    // Only set if the conversation exists in the data
    if (conversationParam) {
      const exists = conversations.some(
        (conv) => conv.id === conversationParam,
      );
      return exists ? conversationParam : null;
    }
    return null;
  });
  const [activeTab, setActiveTab] = useState<"inbox" | "archived">(() =>
    getInitialTab(conversationParam, conversations),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileChat, setShowMobileChat] = useState(() => {
    if (!conversationParam) return false;
    return conversations.some((conv) => conv.id === conversationParam);
  });

  // Filter initial conversations by active tab
  const conversationsForActiveTab = conversations.filter(
    (conv) => (activeTab === "archived") === conv.archived,
  );

  // Convert activeTab to boolean for consistent query key
  const archived = activeTab === "archived";

  // Direct useInfiniteQuery with initialData for proper React Query management
  const {
    data: conversationsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["conversations", archived],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await fetch(
        `/api/messages/conversations?archived=${archived}&offset=${pageParam}&limit=20`,
      );
      if (!response.ok) throw new Error("Failed to fetch conversations");
      const data = await response.json();
      return data as ConversationSummary[];
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 20 ? allPages.length * 20 : undefined;
    },
    initialPageParam: 0,
    // Seed the cache with server-side data for the first page
    initialData: {
      pages: [conversationsForActiveTab],
      pageParams: [0],
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
  });

  const handleConversationClick = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setShowMobileChat(true);

    // Update URL with the selected conversation
    router.replace(`/dashboard/mailbox?conversation=${conversationId}`, {
      scroll: false,
    });
  };

  const handleBackToConversations = () => {
    setShowMobileChat(false);
    setSelectedConversationId(null);

    // Clear the conversation query parameter
    router.replace("/dashboard/mailbox", { scroll: false });
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] bg-white md:h-[calc(100vh-3.5rem)]">
      {/* Desktop Layout */}
      <div className="hidden w-full md:flex">
        {/* Left Sidebar - Conversations */}
        <div className="flex w-80 flex-col border-r border-gray-200">
          <MailboxSearch
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          <MailboxTabs activeTab={activeTab} onTabChange={setActiveTab} />

          <ConversationsList
            conversationsData={conversationsData}
            searchQuery={searchQuery}
            selectedConversationId={selectedConversationId}
            isLoading={isFetchingNextPage}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onConversationClick={handleConversationClick}
            onLoadMore={fetchNextPage}
          />
        </div>

        {/* Right Side - Chat */}
        <div className="flex flex-1 flex-col">
          <ChatArea
            conversationId={selectedConversationId}
            onBackToConversations={handleBackToConversations}
          />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="h-[calc(100vh-3.5rem)] w-full md:hidden">
        {!showMobileChat ? (
          <div className="flex h-full flex-col">
            <MobileHeader
              title="Mailbox"
              description="Communicate with tool owners and borrowers"
            />

            <MailboxSearch
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />

            <MailboxTabs activeTab={activeTab} onTabChange={setActiveTab} />

            <ConversationsList
              conversationsData={conversationsData}
              searchQuery={searchQuery}
              selectedConversationId={selectedConversationId}
              isLoading={isFetchingNextPage}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onConversationClick={handleConversationClick}
              onLoadMore={fetchNextPage}
            />
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <ChatArea
              conversationId={selectedConversationId}
              onBackToConversations={handleBackToConversations}
              showMobileBackButton={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
