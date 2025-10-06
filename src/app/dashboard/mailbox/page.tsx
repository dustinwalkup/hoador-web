export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { MailboxClient } from "@/features/messages/components/mailbox-client";
import { messagesDAL } from "@/dal";

export default async function MailboxPage() {
  const [inboxConversations, archivedConversations] = await Promise.all([
    messagesDAL.getUserConversationsPaginated(false), // inbox
    messagesDAL.getUserConversationsPaginated(true), // archived
  ]);

  // Combine conversations with their archived status
  const allConversations = [...inboxConversations, ...archivedConversations];

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MailboxClient conversations={allConversations} />
    </Suspense>
  );
}
