export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { MailboxClient } from "@/features/messages/components/mailbox-client";
import { MailboxSkeleton } from "@/features/messages/components/mailbox-skeleton";
import { messagesDAL } from "@/dal";

export const metadata = {
  title: "Mailbox",
  description: "View and manage your messages",
};

export default async function MailboxPage() {
  const [inboxConversations, archivedConversations] = await Promise.all([
    messagesDAL.getUserConversationsPaginated(false), // inbox
    messagesDAL.getUserConversationsPaginated(true), // archived
  ]);

  // Combine conversations with their archived status
  const allConversations = [...inboxConversations, ...archivedConversations];

  return (
    <Suspense fallback={<MailboxSkeleton />}>
      <MailboxClient conversations={allConversations} />
    </Suspense>
  );
}
