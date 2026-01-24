"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import {
  MoreHorizontal,
  ArrowLeft,
  Paperclip,
  Send,
  Loader2,
  Archive,
  Trash2,
  Eye,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { sanitizeForDisplay } from "@/lib/utils/sanitize-client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  useSendMessage,
  useMarkConversationUnread,
  useArchiveConversation,
  useUnarchiveConversation,
  useDeleteConversation,
} from "@/features/messages/hooks/use-message-mutations";
import { useConversationDetails } from "@/features/messages/hooks/use-conversations";

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
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrolledConversationRef = useRef<string | null>(null);
  const previousMessageCountRef = useRef<number>(0);

  const sendMessageMutation = useSendMessage();
  const markUnreadMutation = useMarkConversationUnread();
  const archiveMutation = useArchiveConversation();
  const unarchiveMutation = useUnarchiveConversation();
  const deleteMutation = useDeleteConversation();

  const { data: selectedConversation, isLoading: isLoadingConversation } =
    useConversationDetails(conversationId);

  // Get messages from the conversation data, including any optimistic ones
  const messages = selectedConversation?.messages || [];

  // Smooth scroll to bottom function
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      if (smooth) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      } else {
        // Instant scroll for initial load
        container.scrollTop = container.scrollHeight;
      }
    }
  }, []);

  // Handle scrolling - both initial load and new messages
  useEffect(() => {
    if (!selectedConversation || messages.length === 0) return;

    const isInitialLoad = scrolledConversationRef.current !== conversationId;
    const hasNewMessages = messages.length > previousMessageCountRef.current;

    if (isInitialLoad) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        scrollToBottom(false); // Instant scroll for initial load
        scrolledConversationRef.current = conversationId;
        previousMessageCountRef.current = messages.length;
      });
    } else if (hasNewMessages) {
      // Small delay to ensure DOM is updated with new message
      requestAnimationFrame(() => {
        scrollToBottom(true); // Smooth scroll for new messages
        previousMessageCountRef.current = messages.length;
      });
    }
  }, [selectedConversation, messages.length, scrollToBottom, conversationId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const messageContent = newMessage.trim();
    setNewMessage("");

    // Just call the mutation - hook handles optimistic updates
    sendMessageMutation.mutate({
      conversationId: selectedConversation.id,
      content: messageContent,
    });
  };

  const handleMarkUnread = () => {
    if (!selectedConversation) return;

    markUnreadMutation.mutate({ conversationId: selectedConversation.id });
  };

  const handleArchive = () => {
    if (!selectedConversation) return;

    archiveMutation.mutate(
      { conversationId: selectedConversation.id },
      {
        onSuccess: () => {
          setIsArchiveDialogOpen(false);
          onBackToConversations();
        },
      },
    );
  };

  const handleUnarchive = () => {
    if (!selectedConversation) return;

    unarchiveMutation.mutate(
      { conversationId: selectedConversation.id },
      {
        onSuccess: () => {
          setIsArchiveDialogOpen(false);
          onBackToConversations();
        },
      },
    );
  };

  const handleDelete = () => {
    if (!selectedConversation) return;

    deleteMutation.mutate(
      { conversationId: selectedConversation.id },
      {
        onSuccess: () => {
          setIsDeleteDialogOpen(false);
          onBackToConversations();
        },
      },
    );
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {/* Show different options based on conversation status */}
              {!selectedConversation.archived ? (
                <>
                  <DropdownMenuItem onClick={() => handleMarkUnread()}>
                    <Eye className="mr-2 h-4 w-4" />
                    Mark Unread
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => setIsArchiveDialogOpen(true)}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onSelect={() => setIsArchiveDialogOpen(true)}>
                  <Archive className="mr-2 h-4 w-4" />
                  Unarchive
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onSelect={() => setIsDeleteDialogOpen(true)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Archive/Unarchive Confirmation Dialog */}
          <AlertDialog
            open={isArchiveDialogOpen}
            onOpenChange={setIsArchiveDialogOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {selectedConversation.archived
                    ? "Unarchive Conversation"
                    : "Archive Conversation"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {selectedConversation.archived
                    ? "Are you sure you want to unarchive this conversation? It will be moved back to your conversations list."
                    : "Are you sure you want to archive this conversation? It will be moved to your archived conversations and can be restored later."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={
                    selectedConversation.archived
                      ? handleUnarchive
                      : handleArchive
                  }
                >
                  {selectedConversation.archived ? "Unarchive" : "Archive"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Delete Confirmation Dialog */}
          <AlertDialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this conversation? This action
                  cannot be undone and all messages will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Messages Container */}
      <div
        className="scrollbar-hide flex-1 overflow-y-auto"
        ref={messagesContainerRef}
      >
        <div className="space-y-4 p-4">
          {messages.map(
            (message: {
              id: string;
              content: string;
              time: Date;
              sender: "me" | "them";
              senderName: string;
              listingId?: string | null;
              listingName?: string | null;
            }) => (
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
                    {message.listingId && message.listingName && (
                      <Link
                        href={`/listings/${message.listingId}`}
                        className={`mb-2 flex items-center gap-1 text-xs font-medium underline underline-offset-2 ${
                          message.sender === "me"
                            ? "text-white/90 hover:text-white"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>
                          Re: {sanitizeForDisplay(message.listingName)}
                        </span>
                      </Link>
                    )}
                    <p className="text-sm">
                      {sanitizeForDisplay(message.content)}
                    </p>
                  </div>
                  <p
                    className={`mt-1 text-xs text-gray-500 ${
                      message.sender === "me" ? "text-right" : "text-left"
                    }`}
                  >
                    {formatDate(message.time)}
                  </p>
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Message Input or Archived Banner */}
      {selectedConversation.archived ? (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Archive className="h-4 w-4" />
              <span>This conversation is archived. Unarchive to reply.</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsArchiveDialogOpen(true)}
            >
              <Archive className="mr-2 h-4 w-4" />
              Unarchive
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                // TODO: Implement file upload functionality
                toast.info("File upload coming soon!");
              }}
            >
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
              disabled={sendMessageMutation.isPending || !newMessage.trim()}
              className="bg-primary"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
