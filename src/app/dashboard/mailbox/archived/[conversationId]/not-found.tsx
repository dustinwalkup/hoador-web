import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ArchivedConversationNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div className="text-center">
        <h3 className="mb-2 text-lg font-medium">Conversation not found</h3>
        <p className="text-muted-foreground mb-4 text-sm">
          The archived conversation you&apos;re looking for doesn&apos;t exist
          or you don&apos;t have access to it.
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard/mailbox/archived">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Archived Conversations
          </Link>
        </Button>
      </div>
    </div>
  );
}
