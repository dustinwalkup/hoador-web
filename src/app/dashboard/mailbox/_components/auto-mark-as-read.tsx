"use client";

import { useEffect } from "react";
import { markConversationAsReadAction } from "@/lib/actions/mark-conversation-read";

interface AutoMarkAsReadProps {
  conversationId: string;
  isUnread: boolean;
}

export function AutoMarkAsRead({
  conversationId,
  isUnread,
}: AutoMarkAsReadProps) {
  useEffect(() => {
    if (isUnread) {
      // Just call the server action - it handles revalidation
      markConversationAsReadAction(conversationId);
    }
  }, [conversationId, isUnread]);

  return null;
}
