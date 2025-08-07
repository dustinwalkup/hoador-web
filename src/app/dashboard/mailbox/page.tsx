import { Suspense } from "react";
import { messagesDAL } from "@/lib/dal";
import { MailboxClient } from "./_components/mailbox-client";
import { MailboxSkeleton } from "./_components/mailbox-skeleton";

export default async function MailboxPage() {
  // Fetch both inbox and archived conversations server-side
  const [inboxConversations, archivedConversations] = await Promise.all([
    messagesDAL.getUserConversations(false), // false = not archived
    messagesDAL.getUserConversations(true), // true = archived
  ]);

  return (
    <Suspense fallback={<MailboxSkeleton />}>
      <MailboxClient
        initialInboxConversations={inboxConversations}
        initialArchivedConversations={archivedConversations}
      />
    </Suspense>
  );
}
