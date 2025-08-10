"use client";

import { useState, useOptimistic, useTransition, useCallback } from "react";
import {
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
import { formatDistanceToNow } from "date-fns";
import { useConversationDetails } from "@/lib/hooks/use-conversations";

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

  const { data: selectedConversation, isLoading: isLoadingConversation } =
    useConversationDetails(conversationId);

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

  const formatDate = useCallback((date: Date | null) => {
    if (!date) return "";
    return formatDistanceToNow(date, { addSuffix: true });
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
}
