import { Send, Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ConversationList } from "./_components/conversation-list";

export default function MailboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        {/* Conversation List */}
        <ConversationList />

        {/* Message Thread Content */}
        {children}
      </div>
    </div>
  );
}
