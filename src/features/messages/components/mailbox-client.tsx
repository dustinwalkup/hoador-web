"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationParam = searchParams.get("conversation");
  const hasHandledInitialParam = useRef(false);

  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(conversationParam);
  const [activeTab, setActiveTab] = useState<"inbox" | "archived">("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileChat, setShowMobileChat] = useState(!!conversationParam);

  // Handle conversation query parameter only on initial load
  useEffect(() => {
    if (conversationParam && !hasHandledInitialParam.current) {
      // Find which tab the conversation is in
      const conversation = conversations.find(
        (conv) => conv.id === conversationParam,
      );

      if (conversation) {
        // Switch to the appropriate tab if needed
        if (conversation.archived && activeTab !== "archived") {
          setActiveTab("archived");
        } else if (!conversation.archived && activeTab !== "inbox") {
          setActiveTab("inbox");
        }

        // Select the conversation
        setSelectedConversationId(conversationParam);
        setShowMobileChat(true);
      }

      hasHandledInitialParam.current = true;
    }
  }, [conversationParam, conversations, activeTab]);

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
