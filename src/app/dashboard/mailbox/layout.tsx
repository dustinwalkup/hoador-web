import { unstable_noStore } from "next/cache";

import { messagesDAL } from "@/lib/dal";
import { PageHeader } from "@/components/page-header";
import { MailboxContent } from "./_components/mailbox-content";

export default async function MailboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prevent caching to ensure fresh data
  unstable_noStore();

  // Fetch both regular and archived conversations
  const [regularConversations, archivedConversations] = await Promise.all([
    messagesDAL.getUserConversations(false),
    messagesDAL.getUserConversations(true),
  ]);

  return (
    <div className="container flex h-[calc(100vh-8rem)] flex-col py-6">
      <PageHeader
        title="Mailbox"
        description="Communicate with tool owners and borrowers"
      ></PageHeader>

      <div className="flex flex-1 overflow-hidden rounded-lg border">
        {/* Mailbox Content with Conversation List */}
        <MailboxContent
          regularConversations={regularConversations}
          archivedConversations={archivedConversations}
        />

        {/* Message Thread Content */}
        {children}
      </div>
    </div>
  );
}
