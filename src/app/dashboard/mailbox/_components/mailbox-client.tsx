"use client";

import { useState, useOptimistic, useTransition } from "react";
import {
  Search,
  Star,
  Trash2,
  MoreHorizontal,
  ArrowLeft,
  Paperclip,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { sendMessageAction } from "@/lib/actions/send-message";
import { markConversationAsReadAction } from "@/lib/actions/mark-conversation-read";
import {
  ConversationSummary,
  ConversationDetails,
} from "@/lib/dal/messages.dal";
import { formatDistanceToNow } from "date-fns";

interface MailboxClientProps {
  initialInboxConversations: ConversationSummary[];
  initialArchivedConversations: ConversationSummary[];
}

export function MailboxClient({
  initialInboxConversations,
  initialArchivedConversations,
}: MailboxClientProps) {
  const [isPending, startTransition] = useTransition();

  const [inboxConversations, setInboxConversations] = useState(
    initialInboxConversations,
  );
  const [archivedConversations, setArchivedConversations] = useState(
    initialArchivedConversations,
  );
  const [selectedConversation, setSelectedConversation] =
    useState<ConversationDetails | null>(null);
  const [activeTab, setActiveTab] = useState<"inbox" | "archived">("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [showMobileChat, setShowMobileChat] = useState(false);

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

  // Get current conversations based on active tab
  const currentConversations =
    activeTab === "inbox" ? inboxConversations : archivedConversations;

  // Filter conversations based on search
  const filteredConversations = currentConversations.filter(
    (conv) =>
      conv.otherUser.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.lastMessage?.content
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      false,
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

  const handleConversationClick = async (conversation: ConversationSummary) => {
    setSelectedConversation(null); // Clear current conversation while loading

    startTransition(async () => {
      try {
        // Mark as read when opening conversation
        await markConversationAsReadAction(conversation.id);

        // Update conversations list to reflect read status
        if (activeTab === "inbox") {
          setInboxConversations((prev) =>
            prev.map((conv) =>
              conv.id === conversation.id ? { ...conv, unread: false } : conv,
            ),
          );
        } else {
          setArchivedConversations((prev) =>
            prev.map((conv) =>
              conv.id === conversation.id ? { ...conv, unread: false } : conv,
            ),
          );
        }

        // Fetch conversation details
        const response = await fetch(
          `/api/messages/conversations/${conversation.id}`,
        );
        if (!response.ok) throw new Error("Failed to fetch conversation");

        const conversationDetails: ConversationDetails = await response.json();
        setSelectedConversation(conversationDetails);
        setShowMobileChat(true);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load conversation");
      }
    });
  };

  const handleBackToConversations = () => {
    setShowMobileChat(false);
    setSelectedConversation(null);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return formatDistanceToNow(date, { addSuffix: true });
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

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleConversationClick(conversation)}
                className={`flex cursor-pointer items-center border-l-4 p-4 hover:bg-gray-50 ${
                  selectedConversation?.id === conversation.id
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
            ))}
          </div>
        </div>

        {/* Right Side - Chat */}
        <div className="flex flex-1 flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between border-b border-gray-200 p-4">
                <div className="flex items-center">
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
                    <Star className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages Container - Fixed height with scroll */}
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

              {/* Message Input - Fixed at bottom */}
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
          ) : (
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
          )}
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="h-[calc(100vh-3.5rem)] w-full md:hidden">
        {!showMobileChat ? (
          /* Mobile Conversations List */
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="border-b border-gray-200 p-4">
              <h1 className="text-xl font-semibold text-gray-900">Mailbox</h1>
              <p className="mt-1 text-sm text-gray-600">
                Communicate with tool owners and borrowers
              </p>
            </div>

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

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => handleConversationClick(conversation)}
                  className={`flex cursor-pointer items-center border-b border-gray-100 p-4 hover:bg-gray-50 ${
                    conversation.unread ? "bg-blue-50" : ""
                  }`}
                >
                  <Avatar className="mr-3 h-12 w-12">
                    <AvatarFallback className="bg-gray-200 text-sm font-medium text-gray-700">
                      {conversation.otherUser.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="truncate text-base font-medium text-gray-900">
                        {conversation.otherUser.name}
                      </h3>
                      <span className="text-sm text-gray-500">
                        {formatDate(conversation.lastMessageAt)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-600">
                      {conversation.lastMessage?.content || "No messages yet"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Mobile Chat View */
          <div className="flex h-full flex-col">
            {selectedConversation && (
              <>
                {/* Chat Header */}
                <div className="flex items-center border-b border-gray-200 p-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBackToConversations}
                    className="mr-3"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Avatar className="mr-3 h-8 w-8">
                    <AvatarFallback className="bg-gray-200 text-xs font-medium text-gray-700">
                      {selectedConversation.otherUser.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedConversation.otherUser.name}
                    </h2>
                    <p className="text-xs text-gray-600">
                      {formatDate(
                        selectedConversation.messages[
                          selectedConversation.messages.length - 1
                        ]?.time,
                      )}
                    </p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button variant="ghost" size="icon">
                      <Star className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Messages Container - Fixed height with scroll */}
                <div className="flex-1 overflow-y-auto">
                  <div className="space-y-4 p-4">
                    {optimisticMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender === "me" ? "justify-end" : "justify-start"}`}
                      >
                        <div className="max-w-xs">
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

                {/* Message Input - Fixed at bottom */}
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
