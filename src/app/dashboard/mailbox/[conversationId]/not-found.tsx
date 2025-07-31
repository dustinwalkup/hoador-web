import Link from "next/link";
import { MessageCircle, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConversationNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <Card className="max-w-md text-center">
        <CardHeader>
          <div className="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <MessageCircle className="text-muted-foreground h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">Conversation Not Found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            The conversation you&apos;re looking for doesn&apos;t exist or may
            have been removed.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild variant="outline">
              <Link href="/dashboard/mailbox">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Mailbox
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
