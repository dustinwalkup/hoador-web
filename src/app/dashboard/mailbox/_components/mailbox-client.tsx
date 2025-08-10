"use client";

import { useState } from "react";
import { useConversations } from "@/lib/hooks/use-conversations";

import { MobileHeader } from "./mobile-header";
import { MailboxSearch } from "./mailbox-search";
import { MailboxTabs } from "./mailbox-tabs";
import { ConversationsList } from "./conversations-list";
import { ChatArea } from "./chat-area";

export function MailboxClient() {
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [activeTab, setActiveTab] = useState<"inbox" | "archived">("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileChat, setShowMobileChat] = useState(false);

  // React Query hook for conversations
  const {
    data: conversationsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingConversations,
  } = useConversations(activeTab === "archived");

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
            isLoading={isLoadingConversations}
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
              isLoading={isLoadingConversations}
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
