import { Send, Archive } from "lucide-react";
import { unstable_noStore } from "next/cache";

import { messagesDAL } from "@/lib/dal";
import { Button } from "@/components/ui/button";
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
      >
        <Button size="sm" variant="outline" className="h-9">
          <Archive className="mr-2 h-4 w-4" />
          Archive
        </Button>
        <Button size="sm" className="h-9">
          <Send className="mr-2 h-4 w-4" />
          New Message
        </Button>
      </PageHeader>

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
