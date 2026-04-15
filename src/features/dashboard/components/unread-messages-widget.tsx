import Link from "next/link";
import { MessageCircle, ArrowRight, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ConversationSummary } from "@/dal/types";
import { UnreadMessagesEmptyState } from "@/features/dashboard/components/unread-messages-empty-state";

export type { ConversationSummary };

export interface UnreadMessagesWidgetProps {
  unreadCount: number;
  recentConversations: ConversationSummary[];
}

function formatMessageTime(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0)
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

/**
 * Messages widget with sky accent, avatar circles, and clean layout.
 */
export function UnreadMessagesWidget({
  unreadCount,
  recentConversations,
}: UnreadMessagesWidgetProps) {
  const displayConversations = recentConversations.slice(0, 3);
  const hasAny = unreadCount > 0 || displayConversations.length > 0;

  if (!hasAny) {
    return (
      <Card className="border-t-4 border-t-sky-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/10">
                <MessageCircle
                  className="h-4 w-4 text-sky-600 dark:text-sky-400"
                  aria-hidden
                />
              </div>
              <span>Messages</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UnreadMessagesEmptyState />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-t-4 border-t-sky-500">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/10">
                <MessageCircle
                  className="h-4 w-4 text-sky-600 dark:text-sky-400"
                  aria-hidden
                />
              </div>
              <span>Messages</span>
            </div>
          </CardTitle>
          {unreadCount > 0 && (
            <Badge className="bg-sky-500 px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-sky-600">
              {unreadCount} unread
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayConversations.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No recent conversations
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {displayConversations.map((conv) => (
              <li key={conv.id}>
                <Link
                  href={`/dashboard/mailbox?conversation=${conv.id}`}
                  className="group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-sky-50 dark:hover:bg-sky-950/20"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-xs font-bold text-sky-600 dark:text-sky-400">
                    {conv.otherUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        {conv.otherUser.name}
                      </span>
                      {conv.lastMessageAt && (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {formatMessageTime(conv.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {conv.lastMessage.content}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-xs font-medium text-sky-600 hover:bg-sky-50 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-950/20"
        >
          <Link href="/dashboard/mailbox">
            View messages
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
