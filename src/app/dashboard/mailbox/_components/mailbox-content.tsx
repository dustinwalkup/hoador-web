"use client";

import { usePathname } from "next/navigation";

import { ConversationSummary } from "@/lib/dal/messages.dal";
import { ConversationList } from "./conversation-list";
import { ArchivedConversationList } from "./archived-conversation-list";

interface MailboxContentProps {
  regularConversations: ConversationSummary[];
  archivedConversations: ConversationSummary[];
}

export function MailboxContent({
  regularConversations,
  archivedConversations,
}: MailboxContentProps) {
  const pathname = usePathname();
  const isArchived = pathname.includes("/archived");

  return isArchived ? (
    <ArchivedConversationList conversations={archivedConversations} />
  ) : (
    <ConversationList conversations={regularConversations} />
  );
}
