export const dynamic = "force-dynamic";
import { MailboxClient } from "@/features/messages/components/mailbox-client";
import { messagesDAL } from "@/dal";

export default async function MailboxPage() {
  const [inboxConversations, archivedConversations] = await Promise.all([
    messagesDAL.getUserConversationsPaginated(false), // inbox
    messagesDAL.getUserConversationsPaginated(true), // archived
  ]);

  // Combine conversations with their archived status
  const allConversations = [...inboxConversations, ...archivedConversations];

  return <MailboxClient conversations={allConversations} />;
}
