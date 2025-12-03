"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { sendMessageAction } from "@/features/messages/actions/send-message";
import { markConversationUnreadAction } from "@/features/messages/actions/mark-conversation-unread";
import { archiveConversationAction } from "@/features/messages/actions/archive-conversation";
import { unarchiveConversationAction } from "@/features/messages/actions/unarchive-conversation";
import { deleteConversationAction } from "@/features/messages/actions/delete-conversation";
import { useConversationDetails } from "@/features/messages/hooks/use-conversations";
import { ConversationDetails, ConversationSummary } from "@/dal/types";

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
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrolledConversationRef = useRef<string | null>(null);
  const previousMessageCountRef = useRef<number>(0);

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
          time: result.data.createdAt || new Date(),
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

        // Invalidate unread count to update the badge
        queryClient.invalidateQueries({
          queryKey: ["messages", "unread-count"],
        });
      } else {
        toast.error(result.error || "Failed to send message");
      }
    });
  };

  const handleMarkUnread = async () => {
    if (!selectedConversation) return;

    startTransition(async () => {
      try {
        const result = await markConversationUnreadAction(
          selectedConversation.id,
        );

        if (result.success) {
          toast.success("Marked as unread");

          // Update the conversation cache to mark as unread
          queryClient.setQueryData(
            ["conversation-details", conversationId],
            (oldData: ConversationDetails | undefined) => {
              if (!oldData) return oldData;
              return {
                ...oldData,
                unread: true,
              };
            },
          );

          // Also update the conversations list
          queryClient.setQueryData(
            ["conversations", false],
            (oldData: { pages: ConversationSummary[][] } | undefined) => {
              if (!oldData?.pages) return oldData;

              return {
                ...oldData,
                pages: oldData.pages.map((page) =>
                  page.map((conv) =>
                    conv.id === conversationId
                      ? { ...conv, unread: true }
                      : conv,
                  ),
                ),
              };
            },
          );

          // Invalidate unread count to update the badge
          queryClient.invalidateQueries({
            queryKey: ["messages", "unread-count"],
          });
        } else {
          toast.error(String(result.error) || "Failed to mark as unread");
        }
      } catch {
        toast.error("Failed to mark as unread");
      }
    });
  };

  const handleArchive = async () => {
    if (!selectedConversation) return;

    // Optimistically update the UI immediately
    const optimisticConversation: ConversationSummary = {
      id: selectedConversation.id,
      otherUser: selectedConversation.otherUser,
      lastMessage:
        selectedConversation.messages.length > 0
          ? {
              content:
                selectedConversation.messages[
                  selectedConversation.messages.length - 1
                ].content,
              time: selectedConversation.messages[
                selectedConversation.messages.length - 1
              ].time,
              senderId: "temp", // Will be replaced by server data
            }
          : null,
      unread: selectedConversation.unread,
      lastMessageAt:
        selectedConversation.messages.length > 0
          ? selectedConversation.messages[
              selectedConversation.messages.length - 1
            ].time
          : null,
      archived: true,
    };

    // Optimistically remove from active conversations
    queryClient.setQueryData(
      ["conversations", false],
      (oldData: { pages: ConversationSummary[][] } | undefined) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) =>
            page.filter((conv) => conv.id !== conversationId),
          ),
        };
      },
    );

    // Optimistically add to archived conversations
    queryClient.setQueryData(
      ["conversations", true],
      (oldData: { pages: ConversationSummary[][] } | undefined) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: [
            [optimisticConversation, ...(oldData.pages[0] || [])],
            ...oldData.pages.slice(1),
          ],
        };
      },
    );

    // Update current conversation's archived status
    queryClient.setQueryData(
      ["conversation-details", conversationId],
      (oldData: ConversationDetails | undefined) => {
        if (!oldData) return oldData;
        return { ...oldData, archived: true };
      },
    );

    // Note: We don't need to update local state since we're using optimistic cache updates

    startTransition(async () => {
      try {
        const result = await archiveConversationAction(selectedConversation.id);

        if (result.success) {
          toast.success("Conversation archived");
          setIsArchiveDialogOpen(false);

          // Don't invalidate queries - keep the optimistic updates
          // The optimistic updates already show the correct state
        } else {
          // Revert optimistic updates on failure
          toast.error(String(result.error) || "Failed to archive conversation");

          // Revert the optimistic changes
          queryClient.setQueryData(
            ["conversations", false],
            (oldData: { pages: ConversationSummary[][] } | undefined) => {
              if (!oldData?.pages) return oldData;
              return {
                ...oldData,
                pages: [
                  [
                    {
                      id: selectedConversation.id,
                      otherUser: selectedConversation.otherUser,
                      lastMessage:
                        selectedConversation.messages.length > 0
                          ? {
                              content:
                                selectedConversation.messages[
                                  selectedConversation.messages.length - 1
                                ].content,
                              time: selectedConversation.messages[
                                selectedConversation.messages.length - 1
                              ].time,
                              senderId: "temp",
                            }
                          : null,
                      unread: selectedConversation.unread,
                      lastMessageAt:
                        selectedConversation.messages.length > 0
                          ? selectedConversation.messages[
                              selectedConversation.messages.length - 1
                            ].time
                          : null,
                      archived: false,
                    },
                    ...(oldData.pages[0] || []),
                  ],
                  ...oldData.pages.slice(1),
                ],
              };
            },
          );

          queryClient.setQueryData(
            ["conversations", true],
            (oldData: { pages: ConversationSummary[][] } | undefined) => {
              if (!oldData?.pages) return oldData;
              return {
                ...oldData,
                pages: oldData.pages.map((page) =>
                  page.filter((conv) => conv.id !== conversationId),
                ),
              };
            },
          );

          queryClient.setQueryData(
            ["conversation-details", conversationId],
            (oldData: ConversationDetails | undefined) => {
              if (!oldData) return oldData;
              return { ...oldData, archived: false };
            },
          );

          // Note: Cache updates handle the state, no need for local mutations
        }
      } catch {
        toast.error("Failed to archive conversation");

        // Revert optimistic changes on error
        queryClient.setQueryData(
          ["conversations", false],
          (oldData: { pages: ConversationSummary[][] } | undefined) => {
            if (!oldData?.pages) return oldData;
            return {
              ...oldData,
              pages: [
                [
                  {
                    id: selectedConversation.id,
                    otherUser: selectedConversation.otherUser,
                    lastMessage:
                      selectedConversation.messages.length > 0
                        ? {
                            content:
                              selectedConversation.messages[
                                selectedConversation.messages.length - 1
                              ].content,
                            time: selectedConversation.messages[
                              selectedConversation.messages.length - 1
                            ].time,
                            senderId: "temp",
                          }
                        : null,
                    unread: selectedConversation.unread,
                    lastMessageAt:
                      selectedConversation.messages.length > 0
                        ? selectedConversation.messages[
                            selectedConversation.messages.length - 1
                          ].time
                        : null,
                    archived: false,
                  },
                  ...(oldData.pages[0] || []),
                ],
                ...oldData.pages.slice(1),
              ],
            };
          },
        );

        queryClient.setQueryData(
          ["conversations", false],
          (oldData: { pages: ConversationSummary[][] } | undefined) => {
            if (!oldData?.pages) return oldData;
            return {
              ...oldData,
              pages: oldData.pages.map((page) =>
                page.filter((conv) => conv.id !== conversationId),
              ),
            };
          },
        );

        queryClient.setQueryData(
          ["conversation-details", conversationId],
          (oldData: ConversationDetails | undefined) => {
            if (!oldData) return oldData;
            return { ...oldData, archived: false };
          },
        );
      }
    });
  };

  const handleUnarchive = async () => {
    if (!selectedConversation) return;

    // Optimistically update the UI immediately
    const optimisticConversationDetails: ConversationDetails = {
      id: selectedConversation.id,
      otherUser: selectedConversation.otherUser,
      messages: selectedConversation.messages,
      unread: selectedConversation.unread,
      archived: false,
    };

    // Optimistically remove from archived conversations
    queryClient.setQueryData(
      ["conversations", true],
      (oldData: { pages: ConversationSummary[][] } | undefined) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) =>
            page.filter((conv) => conv.id !== conversationId),
          ),
        };
      },
    );

    // Optimistically add to active conversations
    queryClient.setQueryData(
      ["conversations", false],
      (oldData: { pages: ConversationSummary[][] } | undefined) => {
        if (!oldData?.pages) return oldData;

        // Convert ConversationDetails to ConversationSummary
        const optimisticConversationSummary: ConversationSummary = {
          id: optimisticConversationDetails.id,
          otherUser: optimisticConversationDetails.otherUser,
          lastMessage:
            optimisticConversationDetails.messages.length > 0
              ? {
                  content:
                    optimisticConversationDetails.messages[
                      optimisticConversationDetails.messages.length - 1
                    ].content,
                  time: optimisticConversationDetails.messages[
                    optimisticConversationDetails.messages.length - 1
                  ].time,
                  senderId: "temp", // Will be replaced by server data
                }
              : null,
          unread: optimisticConversationDetails.unread,
          lastMessageAt:
            optimisticConversationDetails.messages.length > 0
              ? optimisticConversationDetails.messages[
                  optimisticConversationDetails.messages.length - 1
                ].time
              : null,
          archived: false,
        };

        return {
          ...oldData,
          pages: [
            [optimisticConversationSummary, ...(oldData.pages[0] || [])],
            ...oldData.pages.slice(1),
          ],
        };
      },
    );

    // Update current conversation's archived status
    queryClient.setQueryData(
      ["conversation-details", conversationId],
      (oldData: ConversationDetails | undefined) => {
        if (!oldData) return oldData;
        return { ...oldData, archived: false };
      },
    );

    // Note: We don't need to update local state since we're using optimistic cache updates

    startTransition(async () => {
      try {
        const result = await unarchiveConversationAction(
          selectedConversation.id,
        );

        if (result.success) {
          toast.success("Conversation unarchived");
          setIsArchiveDialogOpen(false);

          // Don't invalidate queries - keep the optimistic updates
          // The optimistic updates already show the correct state
        } else {
          // Revert optimistic updates on failure
          toast.error(
            String(result.error) || "Failed to unarchive conversation",
          );

          // Revert the optimistic changes
          queryClient.setQueryData(
            ["conversations", true],
            (oldData: { pages: ConversationSummary[][] } | undefined) => {
              if (!oldData?.pages) return oldData;
              return {
                ...oldData,
                pages: [
                  [
                    {
                      id: selectedConversation.id,
                      otherUser: selectedConversation.otherUser,
                      lastMessage:
                        selectedConversation.messages.length > 0
                          ? {
                              content:
                                selectedConversation.messages[
                                  selectedConversation.messages.length - 1
                                ].content,
                              time: selectedConversation.messages[
                                selectedConversation.messages.length - 1
                              ].time,
                              senderId: "temp",
                            }
                          : null,
                      unread: selectedConversation.unread,
                      lastMessageAt:
                        selectedConversation.messages.length > 0
                          ? selectedConversation.messages[
                              selectedConversation.messages.length - 1
                            ].time
                          : null,
                      archived: true,
                    },
                    ...(oldData.pages[0] || []),
                  ],
                  ...oldData.pages.slice(1),
                ],
              };
            },
          );

          queryClient.setQueryData(
            ["conversations", false],
            (oldData: { pages: ConversationSummary[][] } | undefined) => {
              if (!oldData?.pages) return oldData;
              return {
                ...oldData,
                pages: oldData.pages.map((page) =>
                  page.filter((conv) => conv.id !== conversationId),
                ),
              };
            },
          );

          queryClient.setQueryData(
            ["conversation-details", conversationId],
            (oldData: ConversationDetails | undefined) => {
              if (!oldData) return oldData;
              return { ...oldData, archived: true };
            },
          );

          // Note: Cache updates handle the state, no need for local mutations
        }
      } catch {
        toast.error("Failed to unarchive conversation");

        // Revert optimistic changes on error
        queryClient.setQueryData(
          ["conversations", false],
          (oldData: { pages: ConversationSummary[][] } | undefined) => {
            if (!oldData?.pages) return oldData;
            return {
              ...oldData,
              pages: [
                [
                  {
                    id: selectedConversation.id,
                    otherUser: selectedConversation.otherUser,
                    lastMessage:
                      selectedConversation.messages.length > 0
                        ? {
                            content:
                              selectedConversation.messages[
                                selectedConversation.messages.length - 1
                              ].content,
                            time: selectedConversation.messages[
                              selectedConversation.messages.length - 1
                            ].time,
                            senderId: "temp",
                          }
                        : null,
                    unread: selectedConversation.unread,
                    lastMessageAt:
                      selectedConversation.messages.length > 0
                        ? selectedConversation.messages[
                            selectedConversation.messages.length - 1
                          ].time
                        : null,
                    archived: true,
                  },
                  ...(oldData.pages[0] || []),
                ],
                ...oldData.pages.slice(1),
              ],
            };
          },
        );

        queryClient.setQueryData(
          ["conversations", false],
          (oldData: { pages: ConversationSummary[][] } | undefined) => {
            if (!oldData?.pages) return oldData;
            return {
              ...oldData,
              pages: oldData.pages.map((page) =>
                page.filter((conv) => conv.id !== conversationId),
              ),
            };
          },
        );

        queryClient.setQueryData(
          ["conversation-details", conversationId],
          (oldData: ConversationDetails | undefined) => {
            if (!oldData) return oldData;
            return { ...oldData, archived: true };
          },
        );
      }
    });
  };

  const handleDelete = async () => {
    if (!selectedConversation) return;

    startTransition(async () => {
      try {
        const result = await deleteConversationAction(selectedConversation.id);

        if (result.success) {
          toast.success("Conversation deleted");

          // Close the delete dialog
          setIsDeleteDialogOpen(false);

          // Invalidate the conversations queries to refetch fresh data
          queryClient.invalidateQueries({ queryKey: ["conversations", false] });
          queryClient.invalidateQueries({ queryKey: ["conversations", true] });

          // Remove conversation details
          queryClient.removeQueries({
            queryKey: ["conversation-details", conversationId],
          });

          // Go back to conversations list
          onBackToConversations();
        } else {
          toast.error(String(result.error) || "Failed to delete conversation");
        }
      } catch {
        toast.error("Failed to delete conversation");
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

                  {/* Archive Action with Confirmation */}
                  <AlertDialog
                    open={isArchiveDialogOpen}
                    onOpenChange={setIsArchiveDialogOpen}
                  >
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Archive Conversation
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to archive this conversation? It
                          will be moved to your archived conversations and can
                          be restored later.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleArchive}>
                          Archive
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <>
                  {/* Unarchive Action with Confirmation */}
                  <AlertDialog
                    open={isArchiveDialogOpen}
                    onOpenChange={setIsArchiveDialogOpen}
                  >
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Archive className="mr-2 h-4 w-4" />
                        Unarchive
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Unarchive Conversation
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to unarchive this conversation?
                          It will be moved back to your conversations list.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUnarchive}>
                          Unarchive
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}

              <DropdownMenuSeparator />

              {/* Delete Action with Confirmation */}
              <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
              >
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this conversation? This
                      action cannot be undone and all messages will be
                      permanently removed.
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
            </DropdownMenuContent>
          </DropdownMenu>
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
                  <p className="mt-1 text-right text-xs text-gray-500">
                    {formatDate(message.time)}
                  </p>
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Message Input */}
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
