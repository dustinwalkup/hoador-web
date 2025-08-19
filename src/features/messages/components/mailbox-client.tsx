"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { MobileHeader } from "./mobile-header";
import { MailboxSearch } from "./mailbox-search";
import { MailboxTabs } from "./mailbox-tabs";
import { ConversationsList } from "./conversations-list";
import { ChatArea } from "./chat-area";
import { ConversationSummary } from "@/dal/types";

export function MailboxClient({
  conversations,
}: {
  conversations: ConversationSummary[];
}) {
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [activeTab, setActiveTab] = useState<"inbox" | "archived">("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileChat, setShowMobileChat] = useState(false);

  // Filter initial conversations by active tab
  const conversationsForActiveTab = conversations.filter(
    (conv) => (activeTab === "archived") === conv.archived,
  );

  // Direct useInfiniteQuery for pagination only (starts at page 1, not 0)
  const {
    data: additionalPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["conversations", activeTab],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await fetch(
        `/api/messages/conversations?archived=${activeTab === "archived"}&offset=${pageParam * 20}&limit=20`,
      );
      if (!response.ok) throw new Error("Failed to fetch conversations");
      const data = await response.json();
      return data as ConversationSummary[];
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 20 ? allPages.length : undefined;
    },
    initialPageParam: 1,
  });

  // Create conversationsData object that matches expected format
  const conversationsData = {
    pages: [conversationsForActiveTab, ...(additionalPages?.pages || [])],
    pageParams: [0, ...(additionalPages?.pageParams || [])],
  };

  const handleConversationClick = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setShowMobileChat(true);
  };

  const handleBackToConversations = () => {
    setShowMobileChat(false);
    setSelectedConversationId(null);
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
