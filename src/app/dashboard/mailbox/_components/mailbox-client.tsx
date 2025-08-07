"use client";

import {
  useState,
  useOptimistic,
  useTransition,
  useMemo,
  useCallback,
} from "react";
import {
  Search,
  MoreHorizontal,
  ArrowLeft,
  Paperclip,
  Send,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { sendMessageAction } from "@/lib/actions/send-message";
import { markConversationAsReadAction } from "@/lib/actions/mark-conversation-read";
import { formatDistanceToNow } from "date-fns";
import {
  useConversations,
  useConversationDetails,
  usePrefetchConversation,
} from "@/lib/hooks/use-conversations";
import { useInfiniteScroll } from "@/lib/hooks/use-infinite-scroll";

export function MailboxClient() {
  const [isPending, startTransition] = useTransition();
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [activeTab, setActiveTab] = useState<"inbox" | "archived">("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [showMobileChat, setShowMobileChat] = useState(false);

  // React Query hooks
  const {
    data: conversationsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingConversations,
  } = useConversations(activeTab === "archived");

  const { data: selectedConversation, isLoading: isLoadingConversation } =
    useConversationDetails(selectedConversationId);

  const prefetchConversation = usePrefetchConversation();

  // Infinite scroll
  const loadMoreRef = useInfiniteScroll(
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  );

  // Flatten conversations from all pages
  const allConversations = useMemo(() => {
    return conversationsData?.pages?.flatMap((page) => page) || [];
  }, [conversationsData]);

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return allConversations;
    return allConversations.filter(
      (conv) =>
        conv.otherUser.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.lastMessage?.content
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
    );
  }, [allConversations, searchQuery]);

  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    selectedConversation?.messages || [],
    (
      state,
      newMessage: {
        id: string;
        content: string;
        time: Date;
        sender: "me" | "them";
        senderName: string;
      },
    ) => [...state, newMessage],
  );

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const messageContent = newMessage.trim();
    setNewMessage("");

    // Add optimistic message
    addOptimisticMessage({
      id: `temp-${Date.now()}`,
      content: messageContent,
      time: new Date(),
      sender: "me",
      senderName: "You",
    });

    startTransition(async () => {
      const result = await sendMessageAction(
        selectedConversation.id,
        messageContent,
      );

      if (!result.success) {
        toast.error(result.error || "Failed to send message");
      }
    });
  };

  const handleBackToConversations = () => {
    setShowMobileChat(false);
    setSelectedConversationId(null);
  };

  const formatDate = useCallback((date: Date | null) => {
    if (!date) return "";
    return formatDistanceToNow(date, { addSuffix: true });
  }, []);

  const handleConversationClick = useCallback(
    async (conversationId: string) => {
      // Immediate optimistic update
      setSelectedConversationId(conversationId);
      setShowMobileChat(true);

      // Mark as read in background
      startTransition(async () => {
        try {
          await markConversationAsReadAction(conversationId);
        } catch (error) {
          console.error("Failed to mark as read:", error);
        }
      });
    },
    [startTransition],
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
    return filteredConversations.map((conversation) => (
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

  const ConversationsList = () => (
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

      {isLoadingConversations && filteredConversations.length === 0 && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );

  const ChatArea = () => {
    if (!selectedConversationId) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900">
              Select a conversation
            </h3>
            <p className="text-sm text-gray-600">
              Choose a conversation to start messaging
            </p>
          </div>
        </div>
      );
    }

    if (isLoadingConversation) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      );
    }

    if (!selectedConversation) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900">
              Conversation not found
            </h3>
            <p className="text-sm text-gray-600">
              This conversation may have been deleted
            </p>
          </div>
        </div>
      );
    }

    return (
      <>
        {/* Chat Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div className="flex items-center">
            {showMobileChat && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackToConversations}
                className="mr-3 md:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <Avatar className="mr-3 h-10 w-10">
              <AvatarFallback className="bg-gray-200 text-sm font-medium text-gray-700">
                {selectedConversation.otherUser.initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedConversation.otherUser.name}
              </h2>
              <p className="text-sm text-gray-600">
                Last active:{" "}
                {formatDate(
                  selectedConversation.messages[
                    selectedConversation.messages.length - 1
                  ]?.time,
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 p-4">
            {optimisticMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === "me" ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-xs lg:max-w-md">
                  <div
                    className={`rounded-2xl px-4 py-2 ${
                      message.sender === "me"
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                  </div>
                  <p className="mt-1 text-right text-xs text-gray-500">
                    {formatDate(message.time)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isPending || !newMessage.trim()}
              className="bg-primary"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] bg-white md:h-[calc(100vh-3.5rem)]">
      {/* Desktop Layout */}
      <div className="hidden w-full md:flex">
        {/* Left Sidebar - Conversations */}
        <div className="flex w-80 flex-col border-r border-gray-200">
          {/* Search */}
          <div className="p-4">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
              <Input
                placeholder="Search messages"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-4 px-4">
            <div className="flex rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setActiveTab("inbox")}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "inbox"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Inbox
              </button>
              <button
                onClick={() => setActiveTab("archived")}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "archived"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Archived
              </button>
            </div>
          </div>

          <ConversationsList />
        </div>

        {/* Right Side - Chat */}
        <div className="flex flex-1 flex-col">
          <ChatArea />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="h-[calc(100vh-3.5rem)] w-full md:hidden">
        {!showMobileChat ? (
          <div className="flex h-full flex-col">
            {/* Mobile Header */}
            <div className="border-b border-gray-200 p-4">
              <h1 className="text-xl font-semibold text-gray-900">Mailbox</h1>
              <p className="mt-1 text-sm text-gray-600">
                Communicate with tool owners and borrowers
              </p>
            </div>

            {/* Mobile Search */}
            <div className="p-4">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                <Input
                  placeholder="Search messages"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Mobile Tabs */}
            <div className="mb-4 px-4">
              <div className="flex rounded-lg bg-gray-100 p-1">
                <button
                  onClick={() => setActiveTab("inbox")}
                  className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === "inbox"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Inbox
                </button>
                <button
                  onClick={() => setActiveTab("archived")}
                  className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === "archived"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Archived
                </button>
              </div>
            </div>

            <ConversationsList />
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <ChatArea />
          </div>
        )}
      </div>
    </div>
  );
}
