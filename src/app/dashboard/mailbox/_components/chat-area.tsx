"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
  ArrowLeft,
  Paperclip,
  Send,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { sendMessageAction } from "@/lib/actions/send-message";
import { useConversationDetails } from "@/lib/hooks/use-conversations";
import type {
  ConversationDetails,
  ConversationSummary,
} from "@/lib/dal/messages.dal";

interface ChatAreaProps {
  conversationId: string | null;
  onBackToConversations: () => void;
  showMobileBackButton?: boolean;
}

export function ChatArea({
  conversationId,
  onBackToConversations,
  showMobileBackButton = false,
}: ChatAreaProps) {
  const [newMessage, setNewMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { data: selectedConversation, isLoading: isLoadingConversation } =
    useConversationDetails(conversationId);

  // Get messages from the conversation data, including any optimistic ones
  const messages = selectedConversation?.messages || [];

  // Scroll to bottom only when the last message renders
  const handleLastMessageRender = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, []);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const messageContent = newMessage.trim();
    setNewMessage("");

    startTransition(async () => {
      // Add optimistic message directly to the cache
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        content: messageContent,
        time: new Date(),
        sender: "me" as const,
        senderName: "You",
      };

      queryClient.setQueryData(
        ["conversation-details", conversationId],
        (oldData: ConversationDetails | undefined) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            messages: [...oldData.messages, optimisticMessage],
          };
        },
      );

      const result = await sendMessageAction(
        selectedConversation.id,
        messageContent,
      );

      if (result.success && result.data) {
        // Transform the raw message to match ConversationDetails format
        const realMessage = {
          id: result.data.id,
          content: result.data.content,
          time: result.data.createdAt,
          sender: "me" as const,
          senderName: "You",
        };

        // Update the conversation cache by replacing the optimistic message with the real one
        // This prevents flickering by maintaining the same position
        queryClient.setQueryData(
          ["conversation-details", conversationId],
          (oldData: ConversationDetails | undefined) => {
            if (!oldData) return oldData;

            // Find and replace the optimistic message instead of removing and re-adding
            const updatedMessages = oldData.messages.map((msg) =>
              msg.id.startsWith("temp-") ? realMessage : msg,
            );

            return {
              ...oldData,
              messages: updatedMessages,
              unread: false, // Mark as read since we just sent a message
            };
          },
        );

        // Also update the conversations list to show the latest message
        queryClient.setQueryData(
          ["conversations", false], // false for non-archived conversations
          (oldData: { pages: ConversationSummary[][] } | undefined) => {
            if (!oldData?.pages) return oldData;

            return {
              ...oldData,
              pages: oldData.pages.map((page) =>
                page.map((conv) =>
                  conv.id === conversationId
                    ? {
                        ...conv,
                        lastMessage: {
                          content: realMessage.content,
                          time: realMessage.time,
                          senderId: result.data!.senderId,
                        },
                        lastMessageAt: realMessage.time,
                        unread: false, // Mark as read since we just sent a message
                      }
                    : conv,
                ),
              ),
            };
          },
        );
      } else {
        toast.error(result.error || "Failed to send message");
      }
    });
  };

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

  if (!conversationId) {
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
          {showMobileBackButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBackToConversations}
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
      <div
        className="scrollbar-hide flex-1 overflow-y-auto"
        ref={messagesContainerRef}
      >
        <div className="space-y-4 p-4">
          {messages.map((message, index) => (
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
              {/* Only call scroll function on the last message */}
              {index === messages.length - 1 && (
                <div ref={() => handleLastMessageRender()} />
              )}
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
}
